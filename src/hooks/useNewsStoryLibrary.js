import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { readStoryLibrary, storyLibraryKey, updateStoryLibrary } from '../lib/newsStoryLibrary';

const CHANGE_EVENT = 'smarty-story-library-changed';

export default function useNewsStoryLibrary() {
  const { user } = useAuth();
  const account = user?.userId || user?.sub || user?.id || user?.email || 'guest';
  const key = storyLibraryKey(account);
  const [revision, refresh] = useReducer(value => value + 1, 0);
  const entries = useMemo(() => readStoryLibrary(account), [account, revision]);
  useEffect(() => {
    const changed = event => { if (event.key === null || event.key === key || event.detail === key) refresh(); };
    window.addEventListener('storage', changed);
    window.addEventListener(CHANGE_EVENT, changed);
    return () => {
      window.removeEventListener('storage', changed);
      window.removeEventListener(CHANGE_EVENT, changed);
    };
  }, [key]);
  const update = useCallback((query, changes) => {
    const result = updateStoryLibrary(account, query, changes);
    if (result.ok) window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {detail: key}));
    return result;
  }, [account, key]);
  return { entries, update };
}
