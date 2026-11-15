import { useEffect } from 'react';
import { newsApi } from '../api/client';
import { createBriefingPreloader, NEWS_FEED_INTENT_EVENT } from '../lib/newsBriefingCache';
import { preloadNewsPage } from '../components/NewsRoute';
import { briefingPlace, readNewsPreference, newsPreferenceKey } from '../lib/newsPreferences';
import { scheduleStartupIdle } from '../lib/startupIdle';

const preloadBriefing = createBriefingPreloader({ load: options => newsApi.getLatestNews(options) });

export default function useBriefingPreload(account, authLoading, enabled) {
  useEffect(() => {
    if (authLoading || !enabled) return undefined;
    const warm = () => {
      if (navigator.onLine === false || document.visibilityState === 'hidden' || navigator.connection?.saveData) return;
      // Start without holding up the feed, splash screen, or account restoration.
      void preloadNewsPage().catch(() => {});
      void preloadBriefing(briefingPlace(readNewsPreference(account))).catch(() => {});
    };
    const preferenceChanged = event => { if (event.detail === account) warm(); };
    const storageChanged = event => { if (event.key === newsPreferenceKey(account)) warm(); };
    const cancelWarm = scheduleStartupIdle(warm);
    window.addEventListener('online', warm);
    window.addEventListener(NEWS_FEED_INTENT_EVENT, warm);
    window.addEventListener('smarty-news-place-changed', preferenceChanged);
    window.addEventListener('storage', storageChanged);
    document.addEventListener('visibilitychange', warm);
    return () => {
      cancelWarm();
      window.removeEventListener('online', warm);
      window.removeEventListener(NEWS_FEED_INTENT_EVENT, warm);
      window.removeEventListener('smarty-news-place-changed', preferenceChanged);
      window.removeEventListener('storage', storageChanged);
      document.removeEventListener('visibilitychange', warm);
    };
  }, [account, authLoading, enabled]);
}
