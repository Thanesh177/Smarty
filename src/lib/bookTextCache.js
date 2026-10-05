// Public book text only. Private shelves and notes remain account-scoped.
const DB_NAME = 'smarty-public-book-text-v1';
const STORE = 'texts';
const MAX_BOOKS = 5;
const MAX_TEXT = 2_000_000;
const MAX_AGE = 7 * 86400000;

export function validBookText(text) {
  return typeof text === 'string' && text.trim().length >= 80 && !/^\s*(?:<!doctype\s+html|<html\b)/i.test(text);
}

async function openCache() {
  if (!globalThis.indexedDB) return null;
  return new Promise(resolve => {
    let finished = false;
    const finish = value => { if (!finished) { finished = true; clearTimeout(timer); resolve(value); } else value?.close(); };
    const timer = setTimeout(() => finish(null), 1500);
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath:'id' });
      request.onsuccess = () => finish(request.result);
      request.onerror = request.onblocked = () => finish(null);
    } catch { finish(null); }
  });
}

async function transact(mode, operation) {
  const db = await openCache();
  if (!db) return null;
  return new Promise(resolve => {
    let output = null, done = false;
    const finish = value => { if (!done) { done = true; clearTimeout(timer); db.close(); resolve(value); } };
    const timer = setTimeout(() => finish(null), 2000);
    try {
      const tx = db.transaction(STORE, mode);
      operation(tx.objectStore(STORE), value => { output = value; });
      tx.oncomplete = () => finish(output);
      tx.onabort = tx.onerror = () => finish(null);
    } catch { finish(null); }
  });
}

export async function readBookTextCache(id, now = Date.now()) {
  const entry = await transact('readonly', (store, result) => {
    const request = store.get(String(id)); request.onsuccess = () => result(request.result);
  });
  if (!entry || !validBookText(entry.text) || entry.text.length > MAX_TEXT || !Number.isFinite(entry.savedAt) || now - entry.savedAt > MAX_AGE) return null;
  return entry.text;
}

export async function saveBookTextCache(id, text, now = Date.now()) {
  if (!validBookText(text) || text.length > MAX_TEXT) return false;
  return Boolean(await transact('readwrite', (store, result) => {
    store.put({ id:String(id), text, savedAt:now });
    const request = store.getAll();
    request.onsuccess = () => {
      const entries = request.result.sort((a,b) => b.savedAt - a.savedAt);
      entries.forEach((entry,index) => { if (index >= MAX_BOOKS || now - entry.savedAt > MAX_AGE) store.delete(entry.id); });
      result(true);
    };
  }));
}
