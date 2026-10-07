import { newsCacheIsFresh } from './newsAvailability.js';

// Public news only. Each reader can cancel without cancelling another reader's
// request (including React's mount/unmount replay). Never cache failed requests.
export function createNewsRequestCache({ now = Date.now, maxEntries = 12 } = {}) {
  const entries = new Map();
  return {
    get(key, load, { signal, forceRefresh = false } = {}) {
      if (signal?.aborted) return Promise.reject(new DOMException('News request cancelled.', 'AbortError'));
      let entry = entries.get(key);
      if (!entry?.pending && (forceRefresh || !entry || !newsCacheIsFresh(entry.value, entry.timestamp, now()))) {
        entries.delete(key);
        while (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
        entry = {};
        entries.set(key, entry);
        entry.pending = Promise.resolve().then(load).then(value => {
          entry.value = value;
          entry.timestamp = now();
          delete entry.pending;
          return value;
        }, error => {
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        });
      }
      const result = entry.pending || Promise.resolve(entry.value);
      if (!signal) return result;
      return new Promise((resolve, reject) => {
        const cancel = () => reject(new DOMException('News request cancelled.', 'AbortError'));
        signal.addEventListener('abort', cancel, { once: true });
        result.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
      });
    },
  };
}
