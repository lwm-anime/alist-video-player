<template>
  <div class="v-col-12 v-col-sm-10 v-col-md-8 v-col-lg-7 v-col-xl-6 v-col-xxl-5 mx-auto my-0">
    <v-main>
      <v-row no-gutters>
        <v-col cols="10">
          <v-breadcrumbs class="pl-2" :items="breadItems"></v-breadcrumbs>
        </v-col>
        <v-col cols="2" align-self="center">
          <v-row no-gutters justify="end">
            <v-col cols="auto">
              <v-tooltip v-if="listView" text="网格视图" location="top">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" density="compact" icon @click="listView = false;">
                    <v-icon color="grey-lighten-1" size="20" :icon="mdiGrid"></v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
              <v-tooltip v-else text="列表视图" location="top">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" density="compact" icon @click="listView = true;">
                    <v-icon color="grey-lighten-1" size="26" :icon="mdiViewListOutline"></v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
      <v-alert v-if="alert.visible" v-bind="alert" class="alert"></v-alert>
      <v-card elevation="5" :loading="loading" :disabled="loading">
        <v-list class="pa-0" :lines="false" style="min-height: 5px;">
          <template v-if="folders.length > 0">
            <v-list-item v-for="folder in folders" :to="folder.href" :key="folder.title"
              class="video-items video-list-item-container">
              <template v-slot:prepend>
                <v-responsive :aspect-ratio="16 / 9" class="mr-2" width="80px">
                  <div class="d-flex align-center justify-center fill-height">
                    <v-avatar color="grey-lighten-1" size="40">
                      <v-icon color="white" :icon="mdiFolder" size="30"></v-icon>
                    </v-avatar>
                  </div>
                </v-responsive>
              </template>
              <div class="title-text">
                {{ folder.title }}
              </div>
              <div class="tips-text">
                {{ folder.tips }}
              </div>
            </v-list-item>
            <v-divider></v-divider>
          </template>

          <template v-if="videoFiles.length > 0 && listView">
            <v-list-item v-for="video in videoFiles" :to="video.href" :key="video.title"
              class="video-items video-list-item-container">
              <template v-slot:prepend>
                <v-responsive :aspect-ratio="16 / 9" class="mr-2" width="80px">
                  <v-img :src="video.thumb" cover class="d-flex align-center justify-center fill-height">
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
              <div class="title-text">
                {{ video.title }}
              </div>
              <div class="tips-text">
                <template v-if="historyTimes[video.href]">
                  上次观看至 {{ formatPlayDuration(historyTimes[video.href]) }}
                </template>
                <template v-else>
                  从未播放
                </template>
              </div>
            </v-list-item>
          </template>
        </v-list>
        <template v-if="!listView">
          <v-row no-gutters>
            <!-- <v-col cols="3" v-for="folder in folders">
              <v-tooltip :text="folder.title" location="top">
                <template v-slot:activator="{ props }">
                  <v-card v-bind="props" class="ma-2" max-width="344" :to="folder.href">
                    <div class="video-card-image d-flex justify-center align-center">
                      <v-avatar color="grey-lighten-1" size="70">
                        <v-icon color="white" :icon="mdiFolder" size="50"></v-icon>
                      </v-avatar>
                    </div>

                    <v-card-title class="pl-2 pb-0 pt-0">
                      <span class="title">{{ folder.title }}</span>
                    </v-card-title>

                    <v-card-subtitle class="pl-2 pb-1">
                      {{ folder.tips }}
                    </v-card-subtitle>
                  </v-card>
                </template>
              </v-tooltip>
            </v-col> -->
            <v-col cols="6" md="4" lg="3" v-for="video in videoFiles">
              <v-tooltip :text="video.title" location="top">
                <template v-slot:activator="{ props }">
                  <v-card v-bind="props" class="ma-2 video-items" max-width="344" :to="video.href">
                    <v-responsive :aspect-ratio="16 / 9">
                      <v-img :src="video.thumb" cover>
                        <template v-slot:error>
                          <v-avatar color="blue" size="70">
                            <v-icon color="white" :icon="mdiMovie" size="50"></v-icon>
                          </v-avatar>
                        </template>
                        <template v-slot:placeholder>
                          <div class="d-flex align-center justify-center fill-height">
                            <v-progress-circular color="grey-lighten-4" indeterminate></v-progress-circular>
                          </div>
                        </template>
                      </v-img>
                    </v-responsive>

                    <v-list-item class="px-2 pb-2">
                      <div class="overflow-hidden video-card-title-container title-text">
                        {{ video.title }}
                      </div>
                      <div class="mt-1 tips-text">
                        <template v-if="historyTimes[video.href]">
                          上次观看至 {{ formatPlayDuration(historyTimes[video.href]) }}
                        </template>
                        <template v-else>
                          从未播放
                        </template>
                      </div>
                    </v-list-item>
                  </v-card>
                </template>
              </v-tooltip>
            </v-col>
          </v-row>
        </template>
      </v-card>
    </v-main>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed, onMounted } from 'vue';
import pathLib from 'path-browserify';
import { useRoute, useRouter } from "vue-router";
import { useSettingsStore, useAppStore } from "@/store/app";
import { storeToRefs } from "pinia";
import { mdiFolder, mdiMovie, mdiViewListOutline, mdiGrid } from "@mdi/js";
import * as api from "@/api";
import { formatPlayDuration } from "@/utils";
import { videoExts, ignoreFolderNamesLowerCase } from "@/globals";

const store = useSettingsStore();
const appStore = useAppStore();
const { listView } = storeToRefs(store);

const route = useRoute();
const router = useRouter();

const currentPath = computed(() => {
  const paths = route.params.paths;
  if (Array.isArray(paths)) {
    return pathLib.join(pathLib.sep, ...paths);
  } else {
    return pathLib.join(pathLib.sep, paths);
  }
});

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

const folders = ref<any[]>([]);
const videoFiles = ref<any[]>([]);
const loading = ref<boolean>(true);
const alert = ref<any>({
  visible: false,
  type: "success",
  title: "",
  text: ""
});

const historyTimes = ref<any>({});
function updateVideoHistory() {
  const artPlayerSettings = localStorage.getItem("artplayer_settings");
  const history = (artPlayerSettings && JSON.parse(artPlayerSettings)?.times) || {};
  historyTimes.value = history;
}

async function getVideoList() {
  if ((!appStore.init) && currentPath.value !== pathLib.sep) {
    appStore.init = true;
    const resp = await api.getPathDetails(currentPath.value);
    if (!resp?.data?.is_dir) {
      router.push(currentPath.value.substring(0, currentPath.value.length));
      return;
    }
  }
  document.title = pathLib.basename(currentPath.value) || "AList Video Player";

  folders.value = [];
  videoFiles.value = [];
  if (currentPath.value != pathLib.sep) {
    folders.value.push({
      title: "..",
      href: pathLib.join(pathLib.dirname(currentPath.value), pathLib.sep),
      tips: "上一级目录",
      folder: true
    });
  }
  try {
    let content;
    if (appStore.dirFilesList && appStore.dirPath === currentPath.value) {
      content = appStore.dirFilesList;
    } else {
      loading.value = true;
      const resp = await api.getFilesList(currentPath.value);
      content = resp?.data?.content?.sort((a: any, b: any) => (a.name > b.name ? 1 : -1)) || [];
    }
    appStore.dirFilesList = content;
    appStore.dirPath = currentPath.value;
    for (const item of content) {
      if (videoExts.includes(pathLib.extname(item.name).toLowerCase())) {
        videoFiles.value.push({
          thumb: item.thumb,
          title: item.name,
          href: pathLib.join(currentPath.value, item.name),
          // tips: "将来要实现的历史记录功能",
          video: true
        });
      } else if (item.is_dir && !ignoreFolderNamesLowerCase.includes(item.name.toLowerCase())) {
        folders.value.push({
          thumb: "",
          title: item.name,
          href: pathLib.join(currentPath.value, item.name, pathLib.sep),
          tips: "文件夹",
          folder: true
        });
      }
    }
    alert.value.visible = false;
  } catch (err) {
    alert.value.type = "error";
    alert.value.visible = true;
    if (err instanceof api.APIError) {
      alert.value.type = "error";
      alert.value.title = `视频文件列表加载失败 (${err.code})`;
      alert.value.text = err.apiMessage;
    } else if (err instanceof Error) {
      alert.value.title = `视频文件列表加载失败`;
      alert.value.text = `${err.name}: ${err.message}`;
    } else {
      alert.value.title = `视频文件列表加载失败`;
      alert.value.text = `未知错误 (${String(err)})`;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  getVideoList();
  updateVideoHistory();
})

watch(currentPath, () => {
  getVideoList();
});

</script>
<style scoped>
.alert {
  margin-bottom: 5px;
}

.video-card-title-container {
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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

@media screen and (min-width: 480px) {
  .title-text {
    font-size: 15px;
  }

  .tips-text {
    font-size: 13px;
    line-height: 17px;
  }

  .video-card-title-container {
    height: 37.5px;
    line-height: 18.75px;
  }

  .video-list-item-container {
    padding-top: 8px;
    padding-bottom: 8px;
  }
}
</style>

<style>
/* .video-items:visited .title-text {
  color: purple;
} */
</style>
