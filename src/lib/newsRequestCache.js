import { newsCacheIsFresh } from './newsAvailability.js';
import { createRequestCache } from './requestCache.js';

// Public news only. Reuse the bounded, cancellation-safe read cache, with a
// freshness policy that also checks the edition date and fallback coverage.
export function createNewsRequestCache({ now = Date.now, maxEntries = 12 } = {}) {
  const cache = createRequestCache({ now, maxEntries, isFresh: newsCacheIsFresh });
  return {
    clear: cache.clear,
    get: (key, load, options = {}) => cache.get(key, load, 60000, options),
  };
}
