import { openDB, DBSchema } from 'idb';

const IDB_FONTS_NAME = "fonts";
const IDB_FONTS_STORE_META = "meta";
const IDB_FONTS_STORE_CACHE = "cache";

interface FontsDB extends DBSchema {
  meta: {
    key: string;
    value: any;
  },
  cache: {
    key: string;
    value: Blob;
  }
}

const dbPromise = openDB<FontsDB>(IDB_FONTS_NAME, 3, {
  upgrade(db, oldVersion) {
    if (oldVersion == 1) {
      // @ts-ignore
      db.deleteObjectStore("fonts");
      localStorage.removeItem("fontsIndex");
    } else if (oldVersion == 2) {
      // @ts-ignore
      db.deleteObjectStore("family");
      db.deleteObjectStore(IDB_FONTS_STORE_META);
      db.deleteObjectStore(IDB_FONTS_STORE_CACHE);
    }
    db.createObjectStore(IDB_FONTS_STORE_META);
    db.createObjectStore(IDB_FONTS_STORE_CACHE);
  },
});

export async function getFontsIndexCache() {
  const db = await dbPromise;
  const content = await db.get(IDB_FONTS_STORE_META, "index");
  if (content) {
    return {
      modified: await db.get(IDB_FONTS_STORE_META, "modified"),
      content
    }
  } else {
    return null;
  }
}

export async function setFontsIndexCache(modified: Date, content: any) {
  const db = await dbPromise;
  await db.put(IDB_FONTS_STORE_META, modified, "modified");
  await db.put(IDB_FONTS_STORE_META, content, "index");
}

export async function getCacheFontBlob(fontFileBaseName: string) {
  const db = await dbPromise;
  return await db.get(IDB_FONTS_STORE_CACHE, fontFileBaseName);
}

export async function setCacheFontBlob(fontFileBaseName: string, blob: Blob) {
  const db = await dbPromise;
  await db.put(IDB_FONTS_STORE_CACHE, blob, fontFileBaseName);
}
