// Short-lived, bounded read cache. Never use for mutations, attempts, or messages.
export function createRequestCache({ maxEntries = 64, now = Date.now } = {}) {
  const entries = new Map();
  let generation = 0;
  return {
    clear() { generation += 1; entries.clear(); },
    async get(key, load, ttlMs = 60000) {
      const existing = entries.get(key);
      if (existing?.pending) return existing.pending;
      if (existing?.expiresAt > now()) return existing.value;
      entries.delete(key);
      while (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
      const epoch = generation;
      const entry = {};
      entry.pending = Promise.resolve().then(load).then(value => {
        if (epoch === generation && entries.get(key) === entry) {
          entry.value = value;
          entry.expiresAt = now() + ttlMs;
          delete entry.pending;
        }
        return value;
      }, error => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      entries.set(key, entry);
      return entry.pending;
    },
  };
}
