import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newsReaderKey, readNewsReader, recordNewsOpen } from '../lib/newsReader';

const CHANGE_EVENT = 'smarty-news-reader-changed';
const EMPTY = { opened: [] };

export default function useNewsReader(account) {
  const key = newsReaderKey(account);
  const [snapshot, setSnapshot] = useState(() => ({ key, value: readNewsReader(account) }));
  const current = useRef(snapshot);
  const activeKey = useRef(key);
  activeKey.current = key;

  useEffect(() => {
    const load = () => {
      const next = { key, value: readNewsReader(account) };
      current.current = next;
      setSnapshot(next);
    };
    load();
    const changed = event => {
      if (event.key === null || event.key === key || event.detail === key) load();
    };
    window.addEventListener('storage', changed);
    window.addEventListener(CHANGE_EVENT, changed);
    return () => {
      window.removeEventListener('storage', changed);
      window.removeEventListener(CHANGE_EVENT, changed);
    };
  }, [account, key]);

  const markOpened = useCallback(url => {
    if (activeKey.current !== key) return;
    const value = recordNewsOpen(current.current.key === key ? current.current.value : EMPTY, url);
    current.current = { key, value };
    setSnapshot(current.current);
    try {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
    } catch { /* In-memory progress still works when device storage is full. */ }
  }, [key]);
  const value = snapshot.key === key ? snapshot.value : EMPTY;
  const opened = useMemo(() => new Set(value.opened.map(item => item.url)), [value]);
  return { opened, markOpened };
}
