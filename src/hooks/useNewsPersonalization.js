import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { newsApi } from '../api/client';
import { readNewsPreference, writeNewsPreference, newsPreferenceKey } from '../lib/newsPreferences';

export default function useNewsPersonalization({ poll = false } = {}) {
  const { user } = useAuth();
  const account = String(user?.sub || user?.userId || user?.id || '');
  const activeAccount = useRef(account);
  activeAccount.current = account;
  const client = useQueryClient(), key = ['news-personalization', account];
  const [local, setLocal] = useState(() => ({ account, value: readNewsPreference(account) }));
  const [syncWarning, setSyncWarning] = useState('');
  const state = useQuery({ queryKey: key, queryFn: newsApi.getPersonalNews, enabled: Boolean(account),
    staleTime: 60000, retry: false, refetchInterval: poll ? 120000 : false, refetchIntervalInBackground: false });
  const preferences = local.account === account && local.value ? local.value : state.data?.preferences || readNewsPreference(account);
  useEffect(() => {
    setLocal({ account, value: readNewsPreference(account) }); setSyncWarning('');
    const changed = event => { if (event.key === newsPreferenceKey(account) || event.detail === account) setLocal({ account, value: readNewsPreference(account) }); };
    window.addEventListener('storage', changed); window.addEventListener('smarty-news-place-changed', changed);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('smarty-news-place-changed', changed); };
  }, [account]);
  useEffect(() => {
    if (state.data?.preferences && !readNewsPreference(account)) {
      const value = writeNewsPreference(account, state.data.preferences);
      setLocal({ account, value });
      window.dispatchEvent(new CustomEvent('smarty-news-place-changed', { detail: account }));
    }
  }, [account, state.data?.preferences]);
  const savePreference = useCallback(async value => {
    const preference = writeNewsPreference(account, value);
    setLocal({ account, value: preference }); setSyncWarning('');
    window.dispatchEvent(new CustomEvent('smarty-news-place-changed', { detail: account }));
    if (!account) return;
    try {
      await client.cancelQueries({ queryKey: key });
      const result = await newsApi.saveNewsPreferences(preference);
      client.setQueryData(key, previous => ({ ...previous, preferences: result.preferences }));
    } catch {
      if (activeAccount.current === account) setSyncWarning('Your place is saved on this device. Account sync is temporarily unavailable.');
    }
  }, [account, client]);
  const mutation = useMutation({ mutationFn: ({ owner, payload }) => {
    if (activeAccount.current !== owner) throw new Error('The active account has changed.');
    return newsApi.updateNewsStory(payload);
  }, onSuccess: (_data, variables) => client.invalidateQueries({ queryKey: ['news-personalization', variables.owner] }) });
  const updateStory = useCallback(payload => mutation.mutateAsync({ owner: account, payload }), [account, mutation.mutateAsync]);
  return { account, preferences, savePreference, syncWarning, stories: state.data?.stories || [], updates: state.data?.updates || [],
    ready: state.isSuccess || Boolean(state.data), error: state.error, refresh: state.refetch,
    updateStory, pending: mutation.isPending };
}
