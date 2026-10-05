export const PULL_THRESHOLD = 100;
export function isVerticalPull(start, current) {
  const y = current.y - start.y, x = Math.abs(current.x - start.x);
  return y > 0 && y > x * 1.4;
}
export function canStartPull(target, root) {
  if (!root || !target?.closest || target.closest('input,textarea,select,button,a,[contenteditable="true"],[role="dialog"],dialog')) return false;
  // A nested scroller must also be at the top; a chat scroll gesture is not a page refresh.
  for (let node = target; node && node !== root.parentElement; node = node.parentElement) {
    if (node.scrollTop > 2) return false;
    if (node === root) break;
  }
  return true;
}
export async function requestPageRefresh(fallback) {
  const tasks = [];
  window.dispatchEvent(new CustomEvent('smarty-global-refresh', { detail:{ waitUntil:task => tasks.push(Promise.resolve(task)) } }));
  if (!tasks.length) await fallback?.();
  else await Promise.allSettled(tasks);
}
