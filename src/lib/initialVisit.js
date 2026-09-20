// Device-level onboarding, deliberately independent of sign-in and sign-out.
export const LANDING_SEEN_KEY = 'smarty.hasPresentedInitialLanding';
let seenInMemory = false;

export function hasSeenLanding(storage) {
  try { return seenInMemory || (storage ?? globalThis.localStorage)?.getItem(LANDING_SEEN_KEY) === 'true'; }
  catch { return seenInMemory; }
}

export function rememberLanding(storage) {
  seenInMemory = true;
  try { (storage ?? globalThis.localStorage)?.setItem(LANDING_SEEN_KEY, 'true'); } catch { /* Private storage may be unavailable. */ }
}
