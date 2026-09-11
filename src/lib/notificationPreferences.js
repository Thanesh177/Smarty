import {
  getUserScope,
  getUserScopedStorageKey,
} from './userScopedStorage.js';

const STORAGE_KEY = 'smarty_notification_preferences_v1';
const ACTIVE_STORAGE_KEY = 'smarty_active_notification_preferences_v1';

export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  enabled: true,
  smartDelivery: true,
  showPreviews: true,
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '07:30',
  },
  categories: {
    messages: true,
    social: true,
    learning: true,
    news: true,
    product: false,
  },
});

const CATEGORY_MATCHERS = {
  safety: ['security', 'safety', 'account', 'moderation', 'password', 'login'],
  messages: ['chat', 'message', 'direct_message', 'dm', 'room_message'],
  social: ['follow', 'like', 'comment', 'mention', 'reply', 'invite', 'social'],
  learning: ['quiz', 'lesson', 'learning', 'progress', 'streak', 'topic', 'review'],
  news: ['news', 'briefing', 'digest', 'headline'],
};

function cleanTime(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''))
    ? String(value)
    : fallback;
}

export function normalizeNotificationPreferences(value = {}) {
  const categories = value?.categories || {};
  const quietHours = value?.quietHours || {};

  return {
    enabled: value.enabled !== false,
    smartDelivery: value.smartDelivery !== false,
    showPreviews: value.showPreviews !== false,
    quietHours: {
      enabled: quietHours.enabled !== false,
      start: cleanTime(quietHours.start, DEFAULT_NOTIFICATION_PREFERENCES.quietHours.start),
      end: cleanTime(quietHours.end, DEFAULT_NOTIFICATION_PREFERENCES.quietHours.end),
    },
    categories: Object.fromEntries(
      Object.entries(DEFAULT_NOTIFICATION_PREFERENCES.categories).map(([key, defaultValue]) => [
        key,
        typeof categories[key] === 'boolean' ? categories[key] : defaultValue,
      ])
    ),
  };
}

export function loadNotificationPreferences(userOrId) {
  try {
    const key = getUserScopedStorageKey(STORAGE_KEY, userOrId);
    const stored = JSON.parse(localStorage.getItem(key) || 'null');
    return normalizeNotificationPreferences(stored || {});
  } catch {
    return normalizeNotificationPreferences();
  }
}

export function loadActiveNotificationPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(ACTIVE_STORAGE_KEY) || 'null');
    return normalizeNotificationPreferences(stored || {});
  } catch {
    return normalizeNotificationPreferences();
  }
}

export async function syncNotificationPreferencesToWorker(preferences) {
  if (!('serviceWorker' in navigator)) return;

  const message = {
    type: 'SMARTY_NOTIFICATION_PREFERENCES',
    preferences: normalizeNotificationPreferences(preferences),
  };

  navigator.serviceWorker.controller?.postMessage(message);

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage(message);
    registration.waiting?.postMessage(message);
  } catch {
    // The worker may not be installed until notifications are enabled.
  }
}

export function saveNotificationPreferences(userOrId, value) {
  const preferences = normalizeNotificationPreferences(value);

  try {
    const key = getUserScopedStorageKey(STORAGE_KEY, userOrId);
    localStorage.setItem(key, JSON.stringify(preferences));
    localStorage.setItem(
      ACTIVE_STORAGE_KEY,
      JSON.stringify({
        ...preferences,
        userScope: getUserScope(userOrId),
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Delivery still works with the in-memory defaults when storage is blocked.
  }

  syncNotificationPreferencesToWorker(preferences);
  window.dispatchEvent(
    new CustomEvent('smarty-notification-preferences-changed', {
      detail: preferences,
    })
  );

  return preferences;
}

export function classifyNotification(detail = {}) {
  const searchable = [
    detail.type,
    detail.category,
    detail.event,
    detail.title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const [category, terms] of Object.entries(CATEGORY_MATCHERS)) {
    if (terms.some((term) => searchable.includes(term))) return category;
  }

  return 'product';
}

function minutesFromMidnight(value) {
  const [hours, minutes] = String(value).split(':').map(Number);
  return hours * 60 + minutes;
}

export function isNotificationQuietTime(preferences, now = new Date()) {
  const quietHours = normalizeNotificationPreferences(preferences).quietHours;
  if (!quietHours.enabled) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutesFromMidnight(quietHours.start);
  const end = minutesFromMidnight(quietHours.end);

  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function getNotificationDecision(detail, preferences, now = new Date()) {
  const normalized = normalizeNotificationPreferences(preferences);
  const category = classifyNotification(detail);
  const isImmediate = category === 'safety' || category === 'messages';

  if (!normalized.enabled) {
    return { deliver: false, reason: 'disabled', category };
  }

  if (category !== 'safety' && normalized.categories[category] === false) {
    return { deliver: false, reason: 'category-disabled', category };
  }

  if (
    normalized.smartDelivery &&
    !isImmediate &&
    isNotificationQuietTime(normalized, now)
  ) {
    return { deliver: false, reason: 'quiet-hours', category };
  }

  return { deliver: true, reason: isImmediate ? 'immediate' : 'allowed', category };
}

export function getNotificationFingerprint(detail = {}) {
  const explicitId =
    detail.messageId ||
    detail.notificationId ||
    detail.rawPayload?.messageId ||
    detail.rawPayload?.data?.messageId ||
    detail.rawPayload?.data?.notificationId;

  if (explicitId) return String(explicitId);

  return [detail.type, detail.title, detail.body, detail.url]
    .map((value) => String(value || '').trim().toLowerCase())
    .join('|');
}

export function getNotificationBody(detail, preferences) {
  const normalized = normalizeNotificationPreferences(preferences);
  const category = classifyNotification(detail);

  if (!normalized.showPreviews && category === 'messages') {
    return 'You have a new message.';
  }

  return detail?.body || 'You have a new update.';
}
