import { NEWS_COUNTRIES, NEWS_REGIONS } from '../data/newsLocations.js';

export const newsPreferenceKey = account => `smarty-news-place-v1-${encodeURIComponent(account || 'guest')}`;
const memoryPreferences = new Map();
export function normalizeNewsPreference(value) {
  if (!value || value.chosen !== true) return null;
  const country = NEWS_COUNTRIES.some(item => item.code === value.country) ? value.country : 'GLOBAL';
  const region = (NEWS_REGIONS[country] || []).includes(value.region) ? value.region : '';
  return { chosen: true, country, region, mode: value.mode === 'local' && country !== 'GLOBAL' ? 'local' : 'world' };
}
export function readNewsPreference(account, storage) {
  const key = newsPreferenceKey(account);
  if (storage === undefined && memoryPreferences.has(key)) return memoryPreferences.get(key);
  try {
    const browserStorage = storage === undefined ? globalThis.localStorage : storage;
    return normalizeNewsPreference(JSON.parse(browserStorage.getItem(key) || 'null'));
  }
  catch { return null; }
}
export function writeNewsPreference(account, value, storage) {
  const preference = normalizeNewsPreference(value);
  const key = newsPreferenceKey(account);
  try {
    const browserStorage = storage === undefined ? globalThis.localStorage : storage;
    browserStorage.setItem(key, JSON.stringify(preference));
    if (storage === undefined) memoryPreferences.delete(key);
  } catch {
    // Some embedded browsers block even reading the storage property. Keep
    // optimistic choices available to other views for the current session.
    if (storage === undefined) {
      memoryPreferences.delete(key);
      memoryPreferences.set(key, preference);
      if (memoryPreferences.size > 16) memoryPreferences.delete(memoryPreferences.keys().next().value);
    }
  }
  return preference;
}
export function briefingPlace(preference) {
  return preference?.mode === 'local' ? { country: preference.country, region: preference.region || '' } : { country: 'GLOBAL', region: '' };
}
