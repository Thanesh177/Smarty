import { NEWS_COUNTRIES, NEWS_REGIONS } from '../data/newsLocations.js';

export const newsPreferenceKey = account => `smarty-news-place-v1-${encodeURIComponent(account || 'guest')}`;
export function normalizeNewsPreference(value) {
  if (!value || value.chosen !== true) return null;
  const country = NEWS_COUNTRIES.some(item => item.code === value.country) ? value.country : 'GLOBAL';
  const region = (NEWS_REGIONS[country] || []).includes(value.region) ? value.region : '';
  return { chosen: true, country, region, mode: value.mode === 'local' && country !== 'GLOBAL' ? 'local' : 'world' };
}
export function readNewsPreference(account, storage = globalThis.localStorage) {
  try { return normalizeNewsPreference(JSON.parse(storage.getItem(newsPreferenceKey(account)) || 'null')); }
  catch { return null; }
}
export function writeNewsPreference(account, value, storage = globalThis.localStorage) {
  const preference = normalizeNewsPreference(value);
  try { storage.setItem(newsPreferenceKey(account), JSON.stringify(preference)); } catch { /* Session state still works. */ }
  return preference;
}
export function briefingPlace(preference) {
  return preference?.mode === 'local' ? { country: preference.country, region: preference.region || '' } : { country: 'GLOBAL', region: '' };
}
