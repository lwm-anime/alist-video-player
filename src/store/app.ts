// Utilities
import { defineStore } from 'pinia'

export const useSettingsStore = () => {
  const innerStore = defineStore('settings', {
    state: () => ({
      init: false,
      listView: true,
      quality: "1080P",
      autoNext: true
    }),
  });
  const s = innerStore();
  if (!s.init) {
    const storage = localStorage.getItem("app_settings");
    if (storage) {
      const data = JSON.parse(storage);
      s.$patch({
        ...data
      });
    }
    s.init = true;
  }
  return s;
}

const settingsStore = useSettingsStore();


settingsStore.$subscribe((mutation, state) => {
  localStorage.setItem('app_settings', JSON.stringify(state));
});

export const useAppStore = defineStore('app', {
  state: () => ({
    init: false,
    dirPath: "",
    dirFilesList: null
  })
});
