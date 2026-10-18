// Native scrolling, not an animation loop. Initial history and prepend-anchor
// corrections stay instant; deliberate jumps and short new-message moves ease in.
export function scrollConversationToEnd(element, {smooth = false, reducedMotion = false} = {}) {
  if (!element) return;
  const top = Math.max(0, element.scrollHeight - element.clientHeight);
  if (Math.abs(top - element.scrollTop) < 1) return;
  if (typeof element.scrollTo === 'function') element.scrollTo({top, behavior: smooth && !reducedMotion ? 'smooth' : 'instant'});
  else element.scrollTop = top;
}

export function shouldPrefetchChatHistory(element, loading, hasMore) {
  return Boolean(element && hasMore && !loading && element.scrollTop <= Math.max(240, element.clientHeight * 0.45));
}
