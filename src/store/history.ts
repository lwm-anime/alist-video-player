import { openDB, DBSchema } from 'idb';

const IDB_HISTORY_NAME = "history";
const IDB_HISTORY_VIDEO_STORE_NAME = "video";

interface VideoHistory {
  last: Date,
  current: number,
  duration: number
}

interface HistoryDB extends DBSchema {
  video: {
    key: string;
    value: VideoHistory;
  };
}

const dbPromise = openDB<HistoryDB>(IDB_HISTORY_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(IDB_HISTORY_VIDEO_STORE_NAME);
  },
});

export async function get(key: string) {
  return (await dbPromise).get(IDB_HISTORY_VIDEO_STORE_NAME, key);
}
export async function set(key: string, val: VideoHistory) {
  return (await dbPromise).put(IDB_HISTORY_VIDEO_STORE_NAME, val, key);
}
export async function del(key: string) {
  return (await dbPromise).delete(IDB_HISTORY_VIDEO_STORE_NAME, key);
}
export async function clear() {
  return (await dbPromise).clear(IDB_HISTORY_VIDEO_STORE_NAME);
}
export async function keys() {
  return (await dbPromise).getAllKeys(IDB_HISTORY_VIDEO_STORE_NAME);
}
