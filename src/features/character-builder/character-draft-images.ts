import type { CharacterPreviewResult } from "./character-workbench";

const DATABASE = "aigc-character-draft-images";
const STORE = "images";
const TAB_KEY = "aigc-character-draft-tab-id";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function keyFor(scope: string): string | null {
  try {
    let tab = sessionStorage.getItem(TAB_KEY);
    if (!tab) { tab = crypto.randomUUID(); sessionStorage.setItem(TAB_KEY, tab); }
    return `${tab}:${scope}`;
  } catch { return null; }
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: "key" }); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function storeDraftImage(scope: string, result: CharacterPreviewResult | null): Promise<boolean> {
  const key = keyFor(scope); if (!key) return false;
  try {
    const db = await database();
    return await new Promise((resolve) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        if (Date.now() - item.value.savedAt > MAX_AGE) item.delete();
        item.continue();
      };
      if (result) store.put({ key, result, savedAt: Date.now() }); else store.delete(key);
      transaction.oncomplete = () => { db.close(); resolve(true); };
      transaction.onerror = transaction.onabort = () => { db.close(); resolve(false); };
    });
  } catch { return false; }
}

export async function readDraftImage(scope: string): Promise<CharacterPreviewResult | null> {
  const key = keyFor(scope); if (!key) return null;
  try {
    const db = await database();
    return await new Promise((resolve) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const item = cursor.result;
        if (!item) return;
        if (Date.now() - item.value.savedAt > MAX_AGE) item.delete();
        item.continue();
      };
      const request = store.get(key);
      request.onsuccess = () => {
        const record = request.result;
        const value = record?.result;
        if (!record || Date.now() - record.savedAt > MAX_AGE || typeof value?.src !== "string" || !value.src.startsWith("data:image/png;base64,") || typeof value?.signature !== "string") {
          if (record) store.delete(key);
          resolve(null);
        } else resolve(value);
      };
      request.onerror = () => resolve(null);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    });
  } catch { return null; }
}
