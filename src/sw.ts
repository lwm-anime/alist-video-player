/// <reference lib="webworker" />

import { videoExts, MAX_RETRIES } from "./globals";
import * as api from "./api";
import * as pathLib from "path-browserify";
import { sleep } from "./utils";

function copyHeaders(r: Request | Response) {
  return Object.fromEntries(r.headers as any);
}

function copyRequestInit(request: Request): RequestInit {
  return {
    method: request.method,
    headers: copyHeaders(request),
    body: request.body,
    mode: request.mode,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity
  };
}

function rawUrlExpired(url: string) {
  const search = new URLSearchParams(url);
  const currentTs = Date.now() / 1000;
  const expiredTs = parseInt(search.get("x-oss-expires")!) || 0;
  return (expiredTs - currentTs) < 60;
}

const rawCache = new Map();
const mpegTsCache: any = {};
const m3u8Cache = new Map();
const transCodingCache = new Map();

function parseAndReplaceM3u8(origin: string, m3u8Base: string, data: string) {
  const base = pathLib.join("/@mediaTs", origin);
  const tsMap: any = new Map();
  const newM3u8Lines = [];
  for (let line of data.split("\n")) {
    line = line.trim();
    if (line && !line.startsWith("#")) {
      const originTsUrl = new URL(line, m3u8Base).href;
      const tsFile = line.slice(0, line.indexOf("?"));
      tsMap.set(tsFile, originTsUrl);
      newM3u8Lines.push(encodeURI(pathLib.join(base, tsFile)));
    } else {
      newM3u8Lines.push(line);
    }
  }
  mpegTsCache[origin] = tsMap;
  const content = newM3u8Lines.join("\n");
  m3u8Cache.set(base, content);
  return content;
}

async function handleAPIGetRequest(request: Request) {
  const reqContent = await request.json();
  const filePath = reqContent.path;
  const resp = await fetch(new Request(request.url, { headers: request.headers, method: request.method, body: JSON.stringify(reqContent) }));
  const data = await resp.json();
  if (videoExts.includes(pathLib.extname(filePath).toLowerCase())) {
    const rawUrl = data?.data?.raw_url;
    if (rawUrl) {
      rawCache.set(filePath, rawUrl);
      // @ts-ignore
      data.data.raw_url = pathLib.join("/@raw", filePath);
    }
  }
  return new Response(JSON.stringify(data), { headers: copyHeaders(resp) });
}

async function handleAPIVideoPreviewRequest(request: Request) {
  const reqText = await request.text();
  const reqContent = JSON.parse(reqText);
  const resp = await fetch(new Request(request.url, { headers: copyHeaders(request), method: request.method, body: reqText }));
  if (reqContent.method !== "video_preview") {
    return resp;
  }
  const filePath = reqContent.path;
  const data = await resp.json();
  if (data.code === 200) {
    for (const item of data.data.video_preview_play_info.live_transcoding_task_list) {
      transCodingCache.set(pathLib.join(filePath, item.template_id), item.url);
      item.url = pathLib.join("/@m3u8", filePath, item.template_id, "media.m3u8");
    }
  }
  return new Response(JSON.stringify(data), { headers: copyHeaders(resp) });
}

async function handleM3u8Request(request: Request) {
  const reqPathname = decodeURIComponent(new URL(request.url).pathname);
  const base = reqPathname.slice(6, -11);
  const filePath = pathLib.normalize(pathLib.join(base, ".."));
  const templateId = pathLib.basename(base);
  let m3u8Content = m3u8Cache.get(base);
  if (!m3u8Content) {
    const cachedM3U8Url = transCodingCache.get(base);
    let rawUrl = cachedM3U8Url;
    if ((!cachedM3U8Url) || rawUrlExpired(cachedM3U8Url)) {
      const resp = await api.getAliyunVideoPreview(filePath);
      for (const item of resp.data.video_preview_play_info.live_transcoding_task_list) {
        transCodingCache.set(pathLib.join(filePath, item.template_id), item.url);
        if (templateId === item.template_id) {
          rawUrl = item.url
        }
        item.url = pathLib.join("/@m3u8", filePath, item.template_id, "media.m3u8");
      }
    }
    const originContent = await fetch(rawUrl, copyRequestInit(request));
    m3u8Content = parseAndReplaceM3u8(base, rawUrl, await originContent.text());
  }
  return new Response(m3u8Content, { headers: { "content-type": "audio/x-mpegurl" } });
}

async function handleMediaTsRequest(request: Request) {
  const reqPathname = decodeURIComponent(new URL(request.url).pathname);
  const url = reqPathname.slice(9);
  const base = pathLib.normalize(pathLib.join(url, ".."));
  const name = pathLib.basename(url);
  let cachedRawUrl = mpegTsCache[base]?.get(name);
  if ((!cachedRawUrl) || rawUrlExpired(cachedRawUrl)) {
    await handleM3u8Request(new Request(pathLib.join("/@m3u8", base, "media.m3u8"), { referrerPolicy: "no-referrer" }));
    cachedRawUrl = mpegTsCache[base]?.get(name);
  }
  let errorCount = 0;
  while (errorCount < MAX_RETRIES) {
    try {
      const resp = await fetch(cachedRawUrl, copyRequestInit(request));
      if (resp.status === 200) {
        return resp;
      } else {
        ++errorCount;
        if (errorCount >= MAX_RETRIES) {
          return resp;
        } else {
          await sleep(3000);
        }
      }
    } catch (err) {
      ++errorCount;
      if (errorCount >= MAX_RETRIES) {
        throw err;
      } else {
        await sleep(3000);
      }
    }
  }
}

async function handleRawFileRequest(request: Request, filePath: string) {
  let rawUrl = rawCache.get(filePath);
  if ((!rawUrl) || rawUrlExpired(rawUrl)) {
    const resp = await api.getPathDetails(filePath);
    const newRawUrl = resp?.data?.raw_url;
    if (newRawUrl) {
      rawCache.set(filePath, newRawUrl);
      rawUrl = newRawUrl;
    }
  }
  const req = copyRequestInit(request);
  req.mode = "cors";
  req.credentials = "same-origin";
  return fetch(rawUrl, req);
}

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event: FetchEvent) => {
  const request = event.request;
  const reqPathname = new URL(request.url).pathname;
  if (reqPathname === "/api/fs/get") {
    event.respondWith(handleAPIGetRequest(request));
  } else if (reqPathname === "/api/fs/other") {
    event.respondWith(handleAPIVideoPreviewRequest(request));
  } else if (reqPathname.startsWith("/@raw")) {
    const filePath = decodeURI(reqPathname.slice(5));
    event.respondWith(handleRawFileRequest(request, filePath));
  } else if (reqPathname.startsWith("/@m3u8")) {
    event.respondWith(handleM3u8Request(request));
  } else if (reqPathname.startsWith("/@mediaTs")) {
    event.respondWith(handleMediaTsRequest(request));
  }
});
