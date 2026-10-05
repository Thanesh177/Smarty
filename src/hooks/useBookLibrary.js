import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { bookKey, getLegacyLibrary, readBookLibrary, saveBookLibrary, updateLibraryEntry } from '../lib/bookLibrary';

export default function useBookLibrary() {
  const { user } = useAuth();
  const account = user?.sub || user?.id || user?.userId || 'guest';
  const [state, setState] = useState(() => ({ account, entries: readBookLibrary(account) }));
  const [error, setError] = useState('');
  const entries = state.account === account ? state.entries : readBookLibrary(account);
  useEffect(() => {
    const refresh = () => setState({ account, entries: readBookLibrary(account) });
    refresh(); setError('');
    window.addEventListener('books-info-refresh', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('books-info-refresh', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [account]);
  const commit = useCallback(next => {
    if (!saveBookLibrary(account, next)) {
      setError('Your reading library could not be saved on this device. Free some storage and try again.'); return false;
    }
    setError(''); setState({ account, entries: next }); window.dispatchEvent(new Event('books-info-refresh')); return true;
  }, [account]);
  const update = useCallback((book, changes) => commit(updateLibraryEntry(readBookLibrary(account), book, changes)), [account, commit]);
  const remove = useCallback(book => commit(readBookLibrary(account).filter(entry => bookKey(entry.book) !== bookKey(book))), [account, commit]);
  const importLegacy = useCallback(() => {
    let next = readBookLibrary(account);
    for (const entry of getLegacyLibrary()) if (!next.some(item => bookKey(item.book) === bookKey(entry.book))) next = updateLibraryEntry(next, entry.book, entry);
    return commit(next);
  }, [account, commit]);
  return { account, entries, update, remove, importLegacy, error };
}
