import '../../public/notification-policy.js';
import { getUserScope, getUserScopedStorageKey } from './userScopedStorage.js';

const policy = globalThis.SmartyNotificationPolicy;
const STORAGE_KEY = 'smarty_notification_preferences_v1';
const ACTIVE_STORAGE_KEY = 'smarty_active_notification_preferences_v1';
const memory = new Map();
let active = { ...policy.normalize(), enabled: false, userScope: 'anonymous' };

export const DEFAULT_NOTIFICATION_PREFERENCES = policy.defaults;
export const normalizeNotificationPreferences = policy.normalize;
export const classifyNotification = policy.classify;
export const isNotificationQuietTime = policy.quiet;
export const getNotificationDecision = policy.decision;
export const getNotificationBody = policy.body;
export const getNotificationPath = policy.safePath;

function remember(key, raw, value) {
  if (!memory.has(key) && memory.size >= 8) memory.delete(memory.keys().next().value);
  memory.set(key, { raw, value });
}

export function loadNotificationPreferences(userOrId) {
  const key = getUserScopedStorageKey(STORAGE_KEY, userOrId);
  try {
    const raw = localStorage.getItem(key), cached = memory.get(key);
    if (cached?.raw === raw) return cached.value;
    const value = policy.normalize(JSON.parse(raw || 'null'));
    remember(key, raw, value);
    return value;
  } catch { return memory.get(key)?.value || policy.normalize(); }
}

export function loadActiveNotificationPreferences() { return active; }

export async function syncNotificationPreferencesToWorker(preferences, userOrId) {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  const message = { type: 'SMARTY_NOTIFICATION_PREFERENCES', preferences: {
    ...policy.normalize(preferences), userScope: userOrId == null ? active.userScope : getUserScope(userOrId),
  } };
  const workers = new Set([navigator.serviceWorker.controller]);
  try {
    // ready can wait forever on a first visit. Sync must not block app startup.
    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    workers.add(registration?.active); workers.add(registration?.waiting);
  } catch { /* WebView/private browsing may not expose a registration. */ }
  if (message.preferences.userScope !== active.userScope ||
      JSON.stringify(policy.normalize(preferences)) !== JSON.stringify(policy.normalize(active))) return;
  workers.forEach(worker => { try { worker?.postMessage(message); } catch { /* Best effort. */ } });
}

export function activateNotificationPreferences(userOrId) {
  const userScope = getUserScope(userOrId);
  active = { ...loadNotificationPreferences(userOrId), userScope };
  if (userScope === 'anonymous') active.enabled = false;
  try { localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify(active)); } catch { /* Memory still works. */ }
  return active;
}

export function saveNotificationPreferences(userOrId, value) {
  const preferences = policy.normalize(value), key = getUserScopedStorageKey(STORAGE_KEY, userOrId);
  const raw = JSON.stringify(preferences);
  try { localStorage.setItem(key, raw); remember(key, raw, preferences); }
  catch {
    let previous = null;
    try { previous = localStorage.getItem(key); } catch { /* Storage fully unavailable. */ }
    remember(key, previous, preferences);
  }
  activateNotificationPreferences(userOrId);
  syncNotificationPreferencesToWorker(active, userOrId);
  window.dispatchEvent(new CustomEvent('smarty-notification-preferences-changed', { detail: preferences }));
  return preferences;
}

export function getNotificationFingerprint(detail = {}) {
  const explicit = detail.messageId || detail.notificationId || detail.rawPayload?.messageId ||
    detail.rawPayload?.data?.messageId || detail.rawPayload?.data?.notificationId;
  return explicit ? String(explicit) : [detail.type, detail.title, detail.body, detail.url]
    .map(value => String(value || '').trim().toLowerCase()).join('|');
}

export function normalizeUnreadCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

// Bounded deduplication without one timeout per alert. Reset on account change.
export function createNotificationDeduper({ now = Date.now, ttlMs = 60000, limit = 128 } = {}) {
  const seen = new Map();
  return {
    clear: () => seen.clear(),
    claim(id) {
      const time = now();
      for (const [key, expiry] of seen) if (expiry <= time) seen.delete(key);
      if (!id || seen.has(id)) return false;
      while (seen.size >= Math.max(1, limit)) seen.delete(seen.keys().next().value);
      seen.set(id, time + ttlMs);
      return true;
    },
  };
}
