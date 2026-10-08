// Short-lived, bounded read cache. Never use for mutations, attempts, or messages.
export function createRequestCache({ maxEntries = 64, now = Date.now, isFresh } = {}) {
  const limit = Number.isFinite(maxEntries) ? Math.max(1, Math.floor(maxEntries)) : 64;
  const entries = new Map();
  let generation = 0;
  return {
    clear() { generation += 1; entries.clear(); },
    delete(key) { entries.delete(key); },
    get(key, load, ttlMs = 60000, { signal, forceRefresh = false } = {}) {
      const aborted = () => new DOMException('Request cancelled.', 'AbortError');
      if (signal?.aborted) return Promise.reject(aborted());
      const subscribe = result => {
        if (!signal) return result;
        return new Promise((resolve, reject) => {
          const cancel = () => reject(aborted());
          signal.addEventListener('abort', cancel, { once: true });
          result.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
        });
      };
      const existing = entries.get(key);
      if (existing?.pending) return subscribe(existing.pending);
      if (existing && !forceRefresh && (isFresh ? isFresh(existing.value, existing.timestamp, now()) : existing.expiresAt > now())) {
        entries.delete(key); entries.set(key, existing); // Least recently used.
        return subscribe(Promise.resolve(existing.value));
      }
      entries.delete(key);
      while (entries.size >= limit) entries.delete(entries.keys().next().value);
      const epoch = generation;
      const entry = {};
      entry.pending = Promise.resolve().then(load).then(value => {
        if (epoch === generation && entries.get(key) === entry) {
          entry.value = value;
          entry.timestamp = now();
          entry.expiresAt = entry.timestamp + Math.max(0, Number(ttlMs) || 0);
          delete entry.pending;
        }
        return value;
      }, error => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      entries.set(key, entry);
      return subscribe(entry.pending);
    },
  };
}
