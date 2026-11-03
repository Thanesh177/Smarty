import { getUserScopedStorageKey } from './userScopedStorage.js';

export const ENGAGEMENT_EVENT = 'smarty:meaningful-engagement';
const DAY = 86400000;
const keyFor = user => getUserScopedStorageKey('smarty:engagement:v1', user);
const empty = now => ({ firstSeen: now, tasks: [], days: [], prompts: [], snoozedUntil: 0, never: false, storeOpened: false });
function storageDefault() { try { return globalThis.localStorage; } catch { return null; } }
export function readEngagement(user, storage = storageDefault(), now = Date.now()) {
  try {
    const value = JSON.parse(storage?.getItem(keyFor(user)) || 'null');
    if (!value || !Number.isFinite(value.firstSeen) || value.firstSeen > now || value.firstSeen < 0) return empty(now);
    return { firstSeen: value.firstSeen, tasks: Array.isArray(value.tasks) ? value.tasks.filter(x => typeof x === 'string').slice(-40) : [],
      days: Array.isArray(value.days) ? value.days.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-14) : [],
      prompts: Array.isArray(value.prompts) ? value.prompts.filter(x => Number.isFinite(x) && x <= now).slice(-3) : [],
      snoozedUntil: Number.isFinite(value.snoozedUntil) ? value.snoozedUntil : 0,
      never: value.never === true, storeOpened: value.storeOpened === true };
  } catch { return empty(now); }
}
function save(user, value, storage) { try { if (!storage) return false; storage.setItem(keyFor(user), JSON.stringify(value)); return true; } catch { return false; } }
export function initializeEngagement(user, storage = storageDefault(), now = Date.now()) {
  const state = readEngagement(user, storage, now); save(user, state, storage); return state;
}
export function canOfferRating(state, now = Date.now()) {
  return !state.never && !state.storeOpened && state.tasks.length >= 3 && state.days.length >= 2 &&
    now - state.firstSeen >= 7 * DAY && now >= state.snoozedUntil &&
    (!state.prompts.length || now - state.prompts[state.prompts.length - 1] >= 90 * DAY) &&
    state.prompts.filter(time => now - time < 365 * DAY).length < 3;
}
export function recordMeaningfulEngagement(user, { kind, id }, storage = storageDefault(), now = Date.now()) {
  if (!['quiz', 'lesson'].includes(kind) || !id) return false;
  const state = readEngagement(user, storage, now), task = `${kind}:${String(id).slice(0, 160)}`;
  if (state.tasks.includes(task)) return false;
  state.tasks = [...state.tasks, task].slice(-40);
  state.days = [...new Set([...state.days, new Date(now).toISOString().slice(0, 10)])].slice(-14);
  if (!save(user, state, storage)) return false; // No nagging if preferences cannot be remembered.
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(ENGAGEMENT_EVENT, { detail: { userId: user, kind, id: task } }));
  return true;
}
export function recordRatingAction(user, action, storage = storageDefault(), now = Date.now()) {
  const state = readEngagement(user, storage, now);
  if (action === 'shown') { if (!canOfferRating(state, now)) return false; state.prompts = [...state.prompts, now].slice(-3); }
  else if (action === 'later') state.snoozedUntil = now + 30 * DAY;
  else if (action === 'never') state.never = true;
  else if (action === 'store') state.storeOpened = true; // Opening a listing is NOT proof of a review.
  else return false;
  return save(user, state, storage);
}
