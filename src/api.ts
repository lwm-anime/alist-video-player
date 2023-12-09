import pathLib from "path-browserify";

export const globalFontsBase = "/globalFonts"

export class APIError extends Error {
  code: number;
  apiMessage: string;
  path?: string;
  constructor(code: number, message: string, path?: string, cause?: Error) {
    super(`AList API 调用出错 (${code})：${message}`, { cause });
    this.code = code;
    this.apiMessage = message;
    this.path = path;
  }
}

export class CustomError extends Error {
  title: string;
  constructor(title: string, message: string, cause?: Error) {
    super(`[${title}] ${message}`, { cause })
    this.title = title;
  }
}

export async function apiFetch(url: string, body: any) {
  try {
    const resp = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      }
    });
    if (resp.status !== 200) {
      throw new APIError(-1, `网关错误 (${resp.status} ${resp.statusText})`, body?.path)
    }
    const data = await resp.json();
    if (data.code !== 200) {
      throw new APIError(data.code, `API 调用错误 (${data.message})`, body?.path)
    }
    return data;
  } catch (err) {
    console.error(err);
    if (err instanceof APIError) {
      throw err;
    } else if (err instanceof TypeError) {
      throw new APIError(-1, `网络错误 (${err.name}: ${err.message})`, body?.path, err);
    } else if (err instanceof Error) {
      throw new APIError(-1, `未知错误 (${err.name}: ${err.message})`, body?.path, err);
    } else {
      throw new APIError(-2, `未知错误 (${String(err)})`, body?.path);
    }
  }
}

export function getFilesList(path: string, refresh: boolean = false) {
  return apiFetch("/api/fs/list", {
    path,
    password: "",
    page: 1,
    per_page: 1000,
    refresh
  });
}

export function getPathDetails(path: string) {
  return apiFetch("/api/fs/get", {
    path,
    password: ""
  });
}

export function getAliyunVideoPreview(path: string) {
  return apiFetch("/api/fs/other", {
    method: "video_preview",
    path,
    password: ""
  });
}

export async function getFileContentResponse(path: string, rawUrl: string = "", headers: any = null): Promise<Response> {
  try {
    if (!rawUrl) {
      const resp = await getPathDetails(path);
      rawUrl = resp?.data?.raw_url || "";
    }
    const fileResponse = await fetch(rawUrl, { headers: headers ?? {} });
    if (fileResponse.status < 200 || fileResponse.status >= 300) {
      throw new CustomError("获取文件内容失败", `${path} (${fileResponse.status} ${fileResponse.statusText})`)
    } else {
      return fileResponse;
    }
  } catch (err) {
    console.error(err);
    if (err instanceof CustomError) {
      throw err;
    } else if (err instanceof APIError) {
      throw new CustomError("获取文件 API 调用出错", `文件 ${path} 获取失败 (${err.apiMessage})`)
    } else if (err instanceof TypeError) {
      throw new CustomError("获取文件时发生网络错误", `文件 ${path} 获取失败 (${err.message})`, err);
    }  else if (err instanceof Error) {
      throw new CustomError("获取文件时发生未知错误", `文件 ${path} 获取失败 (${err.name}: ${err.message})`, err);
    } else {
      throw new CustomError("获取文件时发生未知错误", `文件 ${path} 获取时发生未知错误 (${String(err)})`);
    }
  }
}

export async function getGlobalFontsIndex() {
  try {
    const resp = await getPathDetails(pathLib.join(globalFontsBase, "fonts.json"));
    const modified = resp?.data?.modified && new Date(resp.data.modified);
    const storage = localStorage.getItem("fontsIndex");
    if (storage) {
      const cache = JSON.parse(storage);
      const localModified = new Date(cache.modified);
      if (modified <= localModified) {
        return cache.content;
      }
    }
    const fileResp = await getFileContentResponse(pathLib.join(globalFontsBase, "fonts.json"), resp.data.raw_url);
    const content = await fileResp.json();
    localStorage.setItem("fontsIndex", JSON.stringify({ modified, content }));
    return content;
  } catch (err) {
    if (err instanceof CustomError) {
      err.title = `获取字体索引失败 (${err.title})`;
      throw err;
    } else if (err instanceof APIError) {
      throw new CustomError("获取字体索引失败", `字体索引文件 API 调用失败 (${err.apiMessage})`)
    } else if (err instanceof Error) {
      throw new CustomError("获取字体索引失败", `${err.name}: ${err.message}`, err);
    } else {
      throw new CustomError("获取字体索引失败", `未知错误 (${String(err)})`);
    }
  }
}


