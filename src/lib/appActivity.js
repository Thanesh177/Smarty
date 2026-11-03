import { getUserScopedStorageKey } from './userScopedStorage.js';
export const ACTIVITY_UPDATED = 'smarty:activity-updated';
const keyFor = user => getUserScopedStorageKey('smarty:activity:v1', user);
const memory = new Map();
const safePath = value => typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u001f]/.test(value) ? value.slice(0, 700) : '/learn';
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
function storageDefault() { try { return globalThis.localStorage; } catch { return null; } }
export function readAppActivity(user, storage = storageDefault()) {
  if (!user) return [];
  try { const raw = storage?.getItem(keyFor(user)); const rows = raw ? JSON.parse(raw) : memory.get(keyFor(user)) || [];
    return Array.isArray(rows) ? rows.filter(x => x && typeof x.id === 'string' && ['learning', 'news', 'product'].includes(x.category))
      .slice(0, 40).map(x => ({ id: text(x.id, 180), title: text(x.title, 160), body: text(x.body, 400), category: x.category,
        url: safePath(x.url), read: x.read === true, createdAt: Number.isFinite(x.createdAt) ? x.createdAt : 0 })) : [];
  } catch { return memory.get(keyFor(user)) || []; }
}
function save(user, rows, storage) {
  if (!user) return;
  if (!memory.has(keyFor(user)) && memory.size >= 8) memory.delete(memory.keys().next().value);
  memory.set(keyFor(user), rows);
  try { storage?.setItem(keyFor(user), JSON.stringify(rows)); } catch { /* Keep a bounded session-only inbox. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ACTIVITY_UPDATED, { detail: { userId: user } }));
}
export function addAppActivity(user, detail, storage = storageDefault(), now = Date.now()) {
  if (!user || !detail?.id || !['learning', 'news', 'product'].includes(detail.category)) return false;
  const rows = readAppActivity(user, storage);
  const id = text(detail.id, 180);
  if (rows.some(item => item.id === id)) return false;
  save(user, [{ id, title: text(detail.title, 160), body: text(detail.body, 400), category: detail.category,
    url: safePath(detail.url), read: false, createdAt: now }, ...rows].slice(0, 40), storage);
  return true;
}
export function markAppActivityRead(user, id, storage = storageDefault()) {
  save(user, readAppActivity(user, storage).map(item => id === 'all' || item.id === id ? { ...item, read: true } : item), storage);
}
