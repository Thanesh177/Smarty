const RECOVERY_KEY = 'smarty-chunk-recovery-at';
const RECOVERY_COOLDOWN = 5 * 60 * 1000;

export function isChunkLoadFailure(reason) {
  const message = String(reason?.message || reason || '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (?:CSS )?chunk [\w-]+ failed|Unable to preload CSS for/i.test(message);
}

export function claimChunkRecovery({ storage, online = true, now = Date.now() } = {}) {
  if (!online || !storage) return false;
  try {
    const previous = Number(storage.getItem(RECOVERY_KEY));
    if (previous > 0 && now - previous < RECOVERY_COOLDOWN) return false;
    storage.setItem(RECOVERY_KEY, String(now));
    // Never reload if the browser cannot retain the guard across a reload.
    return storage.getItem(RECOVERY_KEY) === String(now);
  } catch {
    return false;
  }
}
