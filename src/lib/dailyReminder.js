import { getNotificationDecision, normalizeNotificationPreferences } from './notificationPreferences.js';
import { getUserScope } from './userScopedStorage.js';

export function reminderTime(preferences) {
  const value = normalizeNotificationPreferences(preferences);
  if (!value.enabled || !value.categories.learning || !value.dailyReminder.enabled) return null;
  let time = value.dailyReminder.time;
  const [h, m] = time.split(':').map(Number), candidate = new Date(2026, 0, 1, h, m);
  if (!getNotificationDecision({ category: 'learning' }, value, candidate).deliver) {
    if (value.quietHours.start === value.quietHours.end) return null;
    time = value.quietHours.end;
  }
  return time;
}

export function localReminderDay(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

export function nextReminderAt(preferences, now = new Date()) {
  const time = reminderTime(preferences);
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number), date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  if (date <= now) date.setDate(date.getDate() + 1);
  return date;
}

export function reminderDue(preferences, now = new Date()) {
  const time = reminderTime(preferences);
  if (!time) return false;
  const [hours, minutes] = time.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes &&
    getNotificationDecision({ category: 'learning' }, preferences, now).deliver;
}

// Only one reminder per account/local calendar day, including reloads and tabs.
export function claimDailyReminder(userId, now = new Date(), storage = globalThis.localStorage) {
  if (!userId || !storage) return false;
  const key = `smarty-daily-reminder:${getUserScope(userId)}`, day = localReminderDay(now);
  try {
    if (storage.getItem(key) === day) return false;
    storage.setItem(key, day);
    return storage.getItem(key) === day;
  } catch { return false; } // Do not nag when persistence is unavailable.
}

export function learningReminder(library = [], now = new Date()) {
  const due = library.filter(item => item.context?.postId && item.nextReviewAt && Date.parse(item.nextReviewAt) <= now.getTime());
  return due.length ? {
    title: 'A little review goes a long way',
    body: `${due.length} ${due.length === 1 ? 'lesson is' : 'lessons are'} ready to revisit. Take a few minutes to see what you remember.`,
    url: '/learning', type: 'learning_reminder', category: 'learning',
  } : {
    title: 'Make a little room for curiosity', body: 'Read something new, then test what you remember. A few minutes is enough to start.',
    url: '/learning', type: 'learning_reminder', category: 'learning',
  };
}
