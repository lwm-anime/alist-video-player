<template>
  <div class="v-col-12 v-col-lg-10 mx-auto my-0">
    <v-main>
      <v-row no-gutters>
        <v-breadcrumbs :items="breadItems"></v-breadcrumbs>
      </v-row>
      <v-row v-if="alert.visible">
        <v-alert :type="alert.type" :title="alert.title" :text="alert.text" class="alert"
          :closable="alert.type === 'warning'"></v-alert>
      </v-row>
      <v-row justify="center">
        <v-col cols="12" md="8" lg="9" class="pa-0">
          <v-row v-show="videoLoading.visible" no-gutters>
            <v-alert type="info" class="alert" title="视频正在加载，请稍等……">
              <template v-slot:prepend>
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
              </template>
              <template v-slot:text>
                <div>{{ videoLoading.text }}<span v-if="videoLoading.lodingFontsCount > 0">，剩余 {{
                  videoLoading.lodingFontsCount }} 个</span></div>
              </template>
            </v-alert>
          </v-row>
          <v-row v-if="fontsWarnings.error.length > 0 || fontsWarnings.notFound.length > 0" no-gutters>
            <v-alert type="warning" title="字幕字体加载失败" class="alert" closable>
              <template v-slot:text>
                <div v-if="fontsWarnings.notFound.length > 0">字体缺失：{{ fontsWarnings.notFound.join("，") }}</div>
                <div v-if="fontsWarnings.error.length > 0">字体下载失败：{{ fontsWarnings.error.join("，") }}</div>
              </template>
            </v-alert>
          </v-row>
          <v-row no-gutters class="d-flex justify-end">
            <v-responsive v-show="videoLoading.visible && !initCompleted" class="player-container" :aspect-ratio="16 / 9">
              <v-skeleton-loader class="fill-height" :loading-text="videoLoading.text" type="image">
              </v-skeleton-loader>
            </v-responsive>
            <v-responsive v-show="(!videoLoading.visible) || initCompleted" class="player-container"
              :aspect-ratio="16 / 9">
              <div class="player" ref="playerDomRef"></div>
            </v-responsive>
          </v-row>
        </v-col>
        <v-col cols="12" md="4" lg="3" class="pa-0 pl-md-3">
          <v-card style="width: 100%;" elevation="5" :loading="videoListLoading">
            <v-row no-gutters justify="center">
              <v-col cols="12" class="d-flex justify-center align-center">
                <v-switch v-model="autoNext" label="自动连播" inset hide-details color="primary" class="ml-4"></v-switch>
              </v-col>
            </v-row>
            <v-row no-gutters>
              <v-list class="pa-0" :lines="false">
                <v-list-item v-for="video in dirVideoFiles" :to="video.href" :key="video.title"
                  class="video-items video-list-item-container">
                  <template v-slot:prepend>
                    <v-responsive :aspect-ratio="16 / 9" class="mr-2" width="80px">
                      <v-img :src="video.thumb" cover>
                        <template v-slot:error>
                          <div class="d-flex align-center justify-center fill-height">
                            <v-avatar color="blue">
                              <v-icon color="white" :icon="mdiMovie"></v-icon>
                            </v-avatar>
                          </div>
                        </template>
                        <template v-slot:placeholder>
                          <div class="d-flex align-center justify-center fill-height">
                            <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                          </div>
                        </template>
                      </v-img>
                    </v-responsive>
                  </template>
                  <div class="title-text" :style="{ color: (currentPath === video.href ? 'rgb(0, 174, 236)' : '') }">
                    <v-img v-if="currentPath === video.href" :src="playingIcon" inline class="playing-icon"></v-img>
                    {{ video.title }}
                  </div>
                  <div class="tips-text">
                    <template v-if="currentPath === video.href">
                      正在播放
                    </template>
                    <template v-else-if="!video.history">
                      从未播放
                    </template>
                    <template v-else-if="video.history.current / video.history.duration > 0.9">
                      已看完
                    </template>
                    <template v-else>
                      看到 {{ formatPlayDuration(video.history.current) }}
                    </template>
                  </div>
                </v-list-item>
              </v-list>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-main>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import pathLib from 'path-browserify';
import { useRoute, useRouter } from "vue-router";
import * as api from "@/api";
import Hls from "hls.js";
import Artplayer from 'artplayer';
import * as idb from "idb";
import { mdiMovie } from "@mdi/js";
import playingIcon from "@/assets/playing.png";
import { parseAssFonts, formatPlayDuration } from "@/utils";
import { videoExts, defaultFontPath } from "@/globals";
import { useSettingsStore, useAppStore } from "@/store/app";
import { storeToRefs } from "pinia";
import * as history from "@/store/history";

// @ts-ignore
import SubtitlesOctopus from "@/external/subtitles-octopus";


const route = useRoute();
const router = useRouter();
const settingsStore = useSettingsStore();
const appStore = useAppStore();
const currentPath = computed(() => {
  const paths = route.params.paths;
  if (Array.isArray(paths)) {
    return pathLib.join(pathLib.sep, ...paths);
  } else {
    return pathLib.join(pathLib.sep, paths);
  }
});

const { autoNext } = storeToRefs(settingsStore);

const breadItems = computed(() => {
  const temp = [{
    title: '首页',
    disabled: false,
    to: pathLib.sep,
  }];
  let href = "/";
  for (const p of currentPath.value.split(pathLib.sep)) {
    if (p) {
      href = pathLib.join(href, p, pathLib.sep);
      temp.push({
        title: p,
        disabled: false,
        to: href,
      })
    }
  }
  temp[temp.length - 1].disabled = true;
  return temp;
});

let lastUpdateTs = -5001;
const videoListItemMap = new Map();
async function updateVideoHistory() {
  const ts = performance.now();
  if (playerInstance.value?.video && ts - lastUpdateTs > 1000) {
    const videoHistory = {
      current: playerInstance.value.video.currentTime,
      duration: playerInstance.value.video.duration,
      last: new Date()
    };
    await history.set(currentPath.value, videoHistory);
    const listItem = videoListItemMap.get(currentPath.value);
    if (listItem) {
      listItem.history = videoHistory;
    }
    lastUpdateTs = ts;
  }
}

function playM3u8(video: HTMLVideoElement, url: string, art: Artplayer) {
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    art.once('destroy', () => hls.destroy());
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
  } else {
    alert.value.visible = true;
    alert.value.type = "error";
    alert.value.title = "视频播放失败";
    alert.value.text = '浏览器不支持播放此格式：m3u8';
  }
}

const playerDomRef = ref<any>(null);
const playerInstance = ref<Artplayer | null>(null);
const assInstance = ref<SubtitlesOctopus | null>(null);

const alert = ref<{
  visible: boolean;
  type: "error" | "success" | "warning" | "info";
  title: string;
  text: string;
}>({
  visible: false,
  type: "success",
  title: "",
  text: ""
});

const videoLoading = ref({
  visible: true,
  text: "加载中……",
  lodingFontsCount: 0
});
const initCompleted = ref(false);

const dirVideoFiles = ref<any[]>([]);
const dirSubtitleFiles = ref<string[]>([]);
const videoListLoading = ref(true);
// const currentDirPath = computed(() => pathLib.dirname(currentPath.value));
const currentDirFileListPath = ref<string | null>(null);
const fontsWarnings = ref<{
  error: string[],
  notFound: string[]
}>({
  error: [],
  notFound: []
});
const videoDetail = ref<any | null>(null);

async function fileListInit() {
  if (currentDirFileListPath.value === pathLib.dirname(currentPath.value)) {
    return;
  }
  try {
    videoListLoading.value = true;
    if (!appStore.init) {
      const detailResp = await api.getPathDetails(currentPath.value);
      if (detailResp?.data?.is_dir) {
        router.push(pathLib.join(currentPath.value, pathLib.sep));
        return;
      } else {
        videoDetail.value = detailResp?.data;
      }
      appStore.init = true;
    }
    dirVideoFiles.value = [];
    dirSubtitleFiles.value = [];
    if (!(appStore.dirFilesList && appStore.dirPath === pathLib.dirname(currentPath.value))) {
      const resp = await api.getFilesList(pathLib.dirname(currentPath.value));
      const contents = resp.data.content.sort((a: any, b: any) => (a.name > b.name ? 1 : -1));
      appStore.dirFilesList = contents;
      appStore.dirPath = pathLib.dirname(currentPath.value);
    }
    for (const item of appStore.dirFilesList) {
      if (item.is_dir) {
        continue;
      }
      const lowerCaseName = item.name.toLowerCase();
      if (videoExts.includes(pathLib.extname(lowerCaseName))) {
        const videoPath = pathLib.join(pathLib.dirname(currentPath.value), item.name);
        const listItem = {
          thumb: item.thumb,
          title: item.name,
          href: videoPath,
          history: await history.get(videoPath)
        };
        dirVideoFiles.value.push(listItem);
        videoListItemMap.set(videoPath, listItem);
      } else if (pathLib.extname(lowerCaseName).toLowerCase() === ".ass") {
        dirSubtitleFiles.value.push(item.name);
      }
    }
    currentDirFileListPath.value = pathLib.dirname(currentPath.value);
  } catch (err) {
    console.error(err);
    alert.value.type = "error";
    alert.value.visible = true;
    alert.value.title = videoLoading.value.text + "失败";
    if (err instanceof api.CustomError) {
      alert.value.text = err.message;
    } else if (err instanceof api.APIError) {
      alert.value.text = (err.path ? `加载 ${err.path} 失败：` : "") + `${err.apiMessage}`;
    } else if (err instanceof Error) {
      alert.value.text = `${err.name}: ${err.message}`;
    } else {
      alert.value.text = `未知错误 (${String(err)})`;
    }
  } finally {
    videoListLoading.value = false;
  }
}

async function fetchCacheFontFile(db: idb.IDBPDatabase, fontPath: string, fontName: string) {
  try {
    const fontFileBaseName = pathLib.basename(fontPath, pathLib.extname(fontPath));
    let blob = await db.get("fonts", fontFileBaseName);
    if (!blob) {
      const resp = await api.getFileContentResponse(fontPath);
      blob = await resp.blob();
      await db.put("fonts", blob, fontFileBaseName);
    }
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error(err);
    fontsWarnings.value.error.push(fontName);
    return null;
  } finally {
    --videoLoading.value.lodingFontsCount;
  }
}

async function fetchFonts(fonts: string[]) {
  videoLoading.value.text = "获取字体索引";
  const fontsIndex = await api.getGlobalFontsIndex();
  const foundFontsNames = [
    pathLib.basename(defaultFontPath, pathLib.extname(defaultFontPath))
  ];
  const foundFontsPaths = [
    defaultFontPath
  ];
  for (const fontName of fonts) {
    const fontPath = fontsIndex[fontName.toLowerCase()];
    if (fontPath) {
      foundFontsPaths.push(pathLib.join(api.globalFontsBase, fontPath));
      foundFontsNames.push(fontName);
    } else {
      fontsWarnings.value.notFound.push(fontName);
    }
  }
  const db = await idb.openDB("fonts", 1, {
    upgrade(db) {
      db.createObjectStore('fonts');
    },
  });
  videoLoading.value.text = `加载字幕所需字体，共 ${foundFontsPaths.length} 个`;
  videoLoading.value.lodingFontsCount = foundFontsPaths.length;
  const promises: Promise<string | null>[] = [];
  for (const index in foundFontsPaths) {
    const fontPath = foundFontsPaths[index];
    const fontName = foundFontsNames[index];
    promises.push(fetchCacheFontFile(db, fontPath, fontName));
  }
  const results = (await Promise.all(promises)).filter(blobUrl => blobUrl);
  if (results.length === 0) {
    throw new api.CustomError("没有任何加载成功的字体", `包括默认字体`);
  }
  return results;
}

async function fetchAssSubtitleMetadata(assPath: string) {
  const resp = await api.getFileContentResponse(assPath);
  const assBlob = await resp.blob();
  const assText = await assBlob.text();
  const assFonts = parseAssFonts(assText);
  return {
    assFonts,
    ass: URL.createObjectURL(assBlob)
  }
}

function awaitForLibassReady(options: any) {
  return new Promise((resolve, reject) => {
    options.onReady = resolve;
    options.onError = reject;
    assInstance.value = new SubtitlesOctopus(options);
  });
}

async function videoInit() {
  try {
    fontsWarnings.value.notFound = [];
    fontsWarnings.value.error = [];
    alert.value.visible = false;
    videoLoading.value.visible = true;
    videoLoading.value.text = "加载视频元数据";
    await fileListInit();
    if (!videoDetail.value) {
      const detailResp = await api.getPathDetails(currentPath.value);
      videoDetail.value = detailResp?.data;
    }
    const qualities: any[] = [];
    let defaultQuality = null;

    const qualityOrigin = {
      default: settingsStore.quality === '原画',
      html: "原画",
      url: videoDetail.value.raw_url,
      type: ""
    }
    qualities.push(qualityOrigin);
    if (qualityOrigin.default) {
      defaultQuality = qualityOrigin
    }

    if (videoDetail.value.provider === "AliyundriveOpen") {
      const resp = await api.getAliyunVideoPreview(currentPath.value);
      const transcoding = resp.data.video_preview_play_info.live_transcoding_task_list.sort((a: any, b: any) => (a.template_width < b.template_width ? 1 : -1));
      for (const item of transcoding) {
        const html = `${item.template_height}P`;
        const defaultItem = (settingsStore.quality === html);
        const qualityItem = {
          default: defaultItem,
          html: `${item.template_height}P`,
          url: item.url,
          type: "m3u8"
        }
        if (defaultItem) {
          defaultQuality = qualityItem;
        }
        qualities.push(qualityItem);
      }
    }

    if (!defaultQuality) {
      if (qualities.length > 1) {
        defaultQuality = qualities[1];
      } else {
        defaultQuality = qualityOrigin;
      }
      defaultQuality.default = true;
    }

    const controls = [];
    if (qualities.length > 1) {
      controls.push({
        name: 'quality',
        position: 'right',
        index: 10,
        style: { marginRight: "10px" },
        html: defaultQuality!.html,
        selector: qualities,
        onSelect: function (item: any, $dom: HTMLElement) {
          settingsStore.quality = item.html;
          this.type = item.type;
          this.switchQuality(item.url);
          return item.html;
        },
      });
    }

    if (!defaultQuality!.url.startsWith("/@")) {
      alert.value.type = "warning";
      alert.value.visible = true;
      alert.value.title = "后台服务加载失败";
      alert.value.text = "检测到 Service Worker 后台服务未正常运行，可能会影响视频播放，建议刷新页面重试。"
    }

    const videoHistory = await history.get(currentPath.value);
    const artPlayerSettingsJSON = localStorage.getItem("artplayer_settings");
    const artPlayerSettings = artPlayerSettingsJSON ? JSON.parse(artPlayerSettingsJSON) : {};
    const artPlayerTimes = {};
    if (videoHistory) {
      artPlayerTimes[currentPath.value] = videoHistory.current;
    }
    artPlayerSettings.times = artPlayerTimes;
    localStorage.setItem("artplayer_settings", JSON.stringify(artPlayerSettings));

    playerInstance.value = new Artplayer({
      container: playerDomRef.value,
      id: currentPath.value,
      url: defaultQuality!.url,
      type: defaultQuality!.type,
      customType: {
        m3u8: playM3u8,
      },
      controls,
      setting: true,
      pip: true,
      playbackRate: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      autoPlayback: true,
      autoOrientation: true,
      airplay: true,
      lang: navigator.language.toLowerCase(),
    });

    playerInstance.value.on('fullscreenWeb', (state) => {
      document.getElementsByTagName("html")[0].style.overflowY = state ? "hidden" : null;
    });

    const artPlayerReadyPromise = new Promise<void>((resolve, reject) => {
      playerInstance.value?.once("ready", resolve);
      playerInstance.value?.once("error", (event) => {
        alert.value.visible = true;
        if (qualities.length > 1) {
          alert.value.type = "warning";
          alert.value.text = "已自动切换可播放的转码源";
          alert.value.title = "浏览器不支持播放此视频的原画画质"
          const item = qualities[1];
          item.default = true;
          playerInstance.value.type = item.type;
          playerInstance.value.url = item.url;
          qualities.splice(0, 1);
          playerInstance.value.controls.update({
            name: 'quality',
            position: 'right',
            index: 10,
            style: { marginRight: "10px" },
            html: item!.html,
            selector: qualities,
            onSelect: function (item: any, $dom: HTMLElement) {
              settingsStore.quality = item.html;
              this.type = item.type;
              this.switchQuality(item.url);
              return item.html;
            },
          });
        } else {
          alert.value.type = "error";
          alert.value.text = "视频格式不受支持";
          alert.value.title = "浏览器不支持播放此视频"
        }
        resolve();
      });
    }); // 播放器加载完成

    for (const name of ["fullscreenWeb", "volume"]) {
      playerInstance.value.controls[name].classList.add("d-none", "d-md-flex");
    }

    videoLoading.value.text = "加载字幕文件列表";

    const extName = pathLib.extname(currentPath.value);
    const baseName = pathLib.basename(currentPath.value, extName);

    const videoFiles = dirVideoFiles.value.map(item => item.title);
    const videoSubtitleFile = dirSubtitleFiles.value.filter(name => name.includes(baseName)).sort((a, b) => (a > b ? 1 : -1)).map(name => pathLib.join(pathLib.dirname(currentPath.value), name));
    const nextVideoIndex = videoFiles.indexOf(pathLib.basename(currentPath.value)) + 1;
    const nextVideoFile = (nextVideoIndex && nextVideoIndex < videoFiles.length) ? dirVideoFiles.value[nextVideoIndex].href : null;

    if (nextVideoFile) {
      const element = document.createElement("a");
      element.classList.add("next-button");
      element.innerHTML = `<i class="art-icon"><svg enable-background="new 0 0 91 91" height="17px" id="Layer_1" version="1.1" viewBox="0 0 91 91" width="17px" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g><path d="M86.084,83.94c1.69,0.042,2.862-1.398,2.974-2.972c1.771-24.863,1.037-49.898,1.682-74.806   c0.043-1.671-1.548-3.443-3.294-3.294c-6.922,0.589-13.827-0.612-20.761-0.275c-4.582,0.225-4.593,6.006-1.07,7.19   c-0.513,4.593-0.417,9.371-0.542,13.854c-0.146,5.259-0.313,10.52-0.36,15.781c-1.076-0.353-2.354-0.225-3.616,0.667   c-3.458-2.9-6.771-5.961-10.522-8.551c-4.788-3.305-9.718-6.413-14.666-9.472C25.884,15.867,15.493,10.306,5.549,3.976   C3.478,2.655,0.582,4.37,0.643,6.792C1.096,24.667,1.471,42.534,1.494,60.42C1.5,66.193,1.464,71.967,1.488,77.739   c0.008,2.123-0.583,5.569,0.277,7.62c0.679,1.623,2.713,3.129,4.498,1.828C25.339,73.27,45.513,60.91,64.706,47.137   c0.023,11.423,0.107,22.848,0.265,34.269c0.023,1.526,1.355,3.105,2.986,2.985C73.998,83.953,80.03,83.792,86.084,83.94z    M84.125,9.66c-0.126,22.759,0.642,45.574-0.811,68.298c-4.142-0.049-8.278,0.044-12.411,0.28   c-0.176-11.971-0.292-23.94-0.319-35.914c-0.013-6.227-0.197-12.457-0.299-18.687c-0.072-4.515,0.102-9.306-0.328-13.925   C74.654,9.361,79.406,9.792,84.125,9.66z M59.061,41.66C42.48,54.715,24.968,66.589,7.698,78.716   c0.007-0.546,0.088-13.481,0.107-19.402c0.052-15.534,0.083-31.099-0.424-46.63C15.788,17.695,55.522,39.502,59.061,41.66z"/></g></svg></i>`;
      element.href = nextVideoFile;
      element.onclick = function (event: Event) {
        event.preventDefault();
        // @ts-ignore
        router.push(new URL(this.href).pathname);
      }
      playerInstance.value.controls.add({
        name: 'next',
        index: 15,
        position: 'left',
        html: element,
        tooltip: '下一集'
      });
    }

    if (videoSubtitleFile.length > 0) {
      videoLoading.value.text = "加载字幕";
      const { ass, assFonts } = await fetchAssSubtitleMetadata(videoSubtitleFile[0]);
      const successLoadedFonts = await fetchFonts(assFonts);

      const options: any = {
        video: playerDomRef.value.querySelector("video"),
        subUrl: ass, // Link to subtitles
        fonts: successLoadedFonts,
        fallbackFont: successLoadedFonts[0],
        workerUrl: '/libass/subtitles-octopus-worker.js', // Link to WebAssembly-based file "libassjs-worker.js"
        legacyWorkerUrl: '/libass/subtitles-octopus-worker-legacy.js', // Link to non-WebAssembly worker
        targetFps: 60
      };
      const assReadyPromise = awaitForLibassReady(options);

      if (videoSubtitleFile.length > 1) {
        const selector = videoSubtitleFile.map((item, index) => {
          const assTagName = pathLib.basename(item, pathLib.extname(item)).replace(baseName, "");
          const element = document.createElement("span");
          element.innerText = assTagName ?? "默认字幕";
          return {
            html: element,
            default: index == 0,
            url: item
          };
        });
        playerInstance.value.setting.add({
          html: '选择字幕',
          tooltip: '默认',
          selector: selector,
          onSelect: async (item: any, $dom, event) => {
            assInstance.value.freeTrack();
            assInstance.value.dispose();
            videoLoading.value.visible = true;
            videoLoading.value.text = "检测到切换字幕，重新加载字幕";
            const { ass, assFonts } = await fetchAssSubtitleMetadata(item.url);
            const successLoadedFonts = await fetchFonts(assFonts);
            options.subUrl = ass;
            options.fonts = successLoadedFonts;
            videoLoading.value.text = `加载字幕`;
            await awaitForLibassReady(options);
            videoLoading.value.visible = false;
            return item.html;
          },
        });
      }
      videoLoading.value.text = `加载字幕`;
      await assReadyPromise;
    }
    videoLoading.value.text = "加载视频数据";
    // await artPlayerReadyPromise;
    playerInstance.value.on("video:timeupdate", updateVideoHistory);
    playerInstance.value.on("error", (event) => {
      console.error("视频播放发生错误", event);
      alert.value.visible = true;
      alert.value.type = "error";
      alert.value.title = "视频播放时发生错误";
      alert.value.text = "请刷新页面重试"
    });
    playerInstance.value.on("video:ended", (event) => {
      if (autoNext.value) {
        router.push(nextVideoFile);
      }
    });
    if (autoNext.value) {
      playerInstance.value.play();
    }
    videoLoading.value.visible = false;
    initCompleted.value = true;
  } catch (err) {
    console.error(err);
    alert.value.type = "error";
    alert.value.visible = true;
    alert.value.title = videoLoading.value.text + "失败";
    if (err instanceof api.CustomError) {
      alert.value.text = err.message;
    } else if (err instanceof api.APIError) {
      alert.value.text = (err.path ? `加载 ${err.path} 失败：` : "") + `${err.apiMessage}`;
    } else if (err instanceof Error) {
      alert.value.text = `${err.name}: ${err.message}`;
    } else {
      alert.value.text = `未知错误 (${String(err)})`;
    }
  } finally {
    videoLoading.value.visible = false;
  }
}

onMounted(() => {
  document.title = pathLib.basename(currentPath.value);
  updateVideoHistory();
  videoInit();
});

onBeforeUnmount(() => {
  if (playerInstance.value) {
    playerInstance.value.destroy(false);
  }
  if (assInstance.value) {
    assInstance.value.freeTrack();
    assInstance.value.dispose();
    assInstance.value = null;
  }
});
watch(currentPath, () => {
  if (playerInstance.value) {
    playerInstance.value.destroy(false);
  }
  if (assInstance.value) {
    assInstance.value.freeTrack();
    assInstance.value.dispose();
    assInstance.value = null;
  }
  document.title = pathLib.basename(currentPath.value);
  initCompleted.value = false;
  videoDetail.value = null;
  videoInit();
});
</script>

<style scoped>
.player {
  width: 100%;
  height: 100%;
}

.player-container {
  max-width: calc(70vh * (16 / 9));
  max-height: 70vh;
}

.alert {
  margin-bottom: 5px;
}

.video-list-item-container {
  padding-inline: 16px;
  padding-top: 6px;
  padding-bottom: 6px;
}

.title-text {
  font-size: 3.2vmin;
  color: rgb(24, 25, 28);
  font-weight: 500;
  word-break: break-word;
  line-break: anywhere;
}

.tips-text {
  font-size: 2.8vmin;
  font-weight: 400;
  color: rgb(148, 153, 160);
}

.playing-icon {
  width: 2.8vmin;
  height: 2.8vmin;
}

@media screen and (min-width: 480px) {
  .title-text {
    font-size: 14px;
    line-height: 18px;
  }

  .tips-text {
    font-size: 13px;
    line-height: 17px;
  }

  .video-list-item-container {
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .playing-icon {
    width: 12px;
    height: 12px;
  }
}
</style>

<style>
.next-button {
  color: white;
  margin: 0 10px;
  text-decoration: none;
  display: flex;
  height: 17px;
  width: 17px;
}

.next-button i {
  height: 17px !important;
  width: 17px !important;
}

canvas {
  z-index: 50;
}

.v-skeleton-loader__bone.v-skeleton-loader__card {
  height: 100%;
}

.v-skeleton-loader__bone.v-skeleton-loader__image {
  height: 100%;
}
</style>
@/store/history
