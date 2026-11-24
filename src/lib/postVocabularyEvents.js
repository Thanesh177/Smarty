const subscriptions = new WeakMap();
const EVENT_NAME = 'smarty-post-vocabulary-ready';

// All mounted post cards share one browser listener. Candidates are transient;
// the hook still checks the source hash before making any word interactive.
export function subscribePostVocabulary(postId, callback, target = globalThis.window) {
  if (!postId || !target?.addEventListener) return () => {};
  let state = subscriptions.get(target);
  if (!state) {
    state = { posts: new Map(), count: 0, listener: null };
    state.listener = event => {
      const { postId: id, postGlossary } = event.detail || {};
      if (typeof id !== 'string' || !postGlossary) return;
      for (const subscriber of state.posts.get(id) || []) subscriber(postGlossary);
    };
    subscriptions.set(target, state);
    target.addEventListener(EVENT_NAME, state.listener);
  }
  let readers = state.posts.get(postId);
  if (!readers) { readers = new Set(); state.posts.set(postId, readers); }
  const subscriber = candidate => callback(candidate);
  readers.add(subscriber); state.count++;
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    readers.delete(subscriber); state.count--;
    if (!readers.size) state.posts.delete(postId);
    if (!state.count) { target.removeEventListener(EVENT_NAME, state.listener); subscriptions.delete(target); }
  };
}
