import { cleanStoryQuery, storyPeriod } from './newsStories.js';

const MAX_STORIES = 50;
const MAX_OPENED = 200;
export const storyLibraryKey = account => `smarty-story-library-v1-${encodeURIComponent(String(account || 'guest'))}`;

export function readStoryLibrary(account, storage) {
  try {
    const data = JSON.parse((storage ?? globalThis.localStorage).getItem(storyLibraryKey(account)) || '[]');
    if (!Array.isArray(data)) return [];
    const seen = new Set();
    return data.flatMap(entry => {
      if (!entry || typeof entry !== 'object' || typeof entry.query !== 'string') return [];
      const query = cleanStoryQuery(entry.query), identity = query.toLocaleLowerCase();
      if (query.length < 3 || seen.has(identity)) return [];
      seen.add(identity);
      const period = storyPeriod(new URLSearchParams({year: entry.year || '', month: entry.month || '', order: entry.order || ''}));
      return [{ query, ...period, saved: entry.saved === true,
        opened: [...new Set((Array.isArray(entry.opened) ? entry.opened : []).filter(id => typeof id === 'string' && id.length > 0 && id.length <= 2048))].slice(-MAX_OPENED),
        updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : 0 }];
    }).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_STORIES);
  } catch { return []; }
}

export function updateStoryLibrary(account, query, changes, storage) {
  query = cleanStoryQuery(query);
  if (query.length < 3) return { ok: false, error: 'Enter a subject before saving this story.' };
  const entries = readStoryLibrary(account, storage);
  const current = entries.find(entry => entry.query.toLocaleLowerCase() === query.toLocaleLowerCase());
  const period = storyPeriod(new URLSearchParams({year: changes.year ?? current?.year ?? '', month: changes.month ?? current?.month ?? '', order: changes.order ?? current?.order ?? ''}));
  const opened = current?.opened || [];
  const entry = { query, ...period, saved: changes.saved ?? current?.saved ?? false,
    opened: changes.openedId ? [...opened.filter(id => id !== changes.openedId), String(changes.openedId)].slice(-MAX_OPENED) : opened,
    updatedAt: Date.now() };
  const remaining = entries.filter(item => item !== current);
  if (remaining.length >= MAX_STORIES) {
    let disposable = -1;
    for (let index = remaining.length - 1; index >= 0; index--) {
      if (!remaining[index].saved) { disposable = index; break; }
    }
    if (disposable < 0) return {ok: false, error: 'Your 50 saved-story slots are full. Remove a story to save another.'};
    remaining.splice(disposable, 1);
  }
  try {
    (storage ?? globalThis.localStorage).setItem(storyLibraryKey(account), JSON.stringify([entry, ...remaining]));
    return {ok: true};
  } catch { return {ok: false, error: 'Could not save on this device. Your timeline is still available.'}; }
}

export function savedStoryUrl(entry) {
  return `/news/story?${new URLSearchParams({q: entry.query, year: entry.year, month: entry.month, order: entry.order})}`;
}
