export const WELCOME_TOUR_KEY = 'smarty:welcome-tour:v1';
let memoryState = null;

export function readWelcomeTour(storage) {
  try {
    const saved = (storage ?? globalThis.localStorage)?.getItem(WELCOME_TOUR_KEY);
    if (saved === 'done' || memoryState === 'done') return 'done';
    if (saved === 'pending' || memoryState === 'pending') return 'pending';
  } catch { return memoryState; }
  return null;
}

export function shouldOfferWelcomeTour(seenLanding, storage) {
  const state = readWelcomeTour(storage);
  return state === 'pending' || (!seenLanding && state !== 'done');
}

function writeWelcomeTour(state, storage) {
  memoryState = state;
  try { (storage ?? globalThis.localStorage)?.setItem(WELCOME_TOUR_KEY, state); }
  catch { /* Still remember the choice for this session. */ }
}

export function queueWelcomeTour(storage) {
  if (!readWelcomeTour(storage)) writeWelcomeTour('pending', storage);
}

export function finishWelcomeTour(storage) {
  writeWelcomeTour('done', storage);
}

export function isWelcomeTourEntry({ pathname, search }) {
  return pathname === '/feed' && new URLSearchParams(search).get('topic')?.trim().toLowerCase() === 'all';
}
