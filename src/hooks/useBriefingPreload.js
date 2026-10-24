import { useEffect } from 'react';
import { newsApi } from '../api/client';
import { createBriefingPreloader } from '../lib/newsBriefingCache';
import { briefingPlace, readNewsPreference, newsPreferenceKey } from '../lib/newsPreferences';

const preloadBriefing = createBriefingPreloader({ load: options => newsApi.getLatestNews(options) });

export default function useBriefingPreload(account, authLoading, enabled) {
  useEffect(() => {
    if (authLoading || !enabled) return undefined;
    const warm = () => {
      if (navigator.onLine === false || document.visibilityState === 'hidden') return;
      // Start without holding up the feed, splash screen, or account restoration.
      void preloadBriefing(briefingPlace(readNewsPreference(account))).catch(() => {});
    };
    const preferenceChanged = event => { if (event.detail === account) warm(); };
    const storageChanged = event => { if (event.key === newsPreferenceKey(account)) warm(); };
    warm();
    window.addEventListener('online', warm);
    window.addEventListener('smarty-news-place-changed', preferenceChanged);
    window.addEventListener('storage', storageChanged);
    document.addEventListener('visibilitychange', warm);
    return () => {
      window.removeEventListener('online', warm);
      window.removeEventListener('smarty-news-place-changed', preferenceChanged);
      window.removeEventListener('storage', storageChanged);
      document.removeEventListener('visibilitychange', warm);
    };
  }, [account, authLoading, enabled]);
}
