import { FEED_VIEWS } from './feedViews.js';

export function swipeDestination(view, { dx, dy, elapsed = 0, width = 390, touches = 1 } = {}) {
  if (touches !== 1 || elapsed > 1500 || !Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const distance = Math.max(54, Math.min(96, width * .16));
  if (Math.abs(dx) < distance || Math.abs(dx) < Math.abs(dy) * 1.7) return null;
  const index = FEED_VIEWS.findIndex(item => item.id === view);
  if (index < 0) return null;
  return FEED_VIEWS[index + (dx < 0 ? 1 : -1)] || null;
}

export function swipeTargetAllowed(target, boundary) {
  if (!target?.closest || target.closest('input,textarea,select,video,audio,[contenteditable="true"],dialog,[role="dialog"],[data-no-feed-swipe]')) return false;
  const inToggle = Boolean(target.closest('.feed-view-switch'));
  if (!inToggle && target.closest('button,a,[role="slider"],[role="button"]:not(.snap-post)')) return false;
  for (let element = target; element && element !== boundary; element = element.parentElement) {
    if (!inToggle && element.scrollWidth > element.clientWidth + 4 && ['auto', 'scroll'].includes(getComputedStyle(element).overflowX)) return false;
  }
  return true;
}
