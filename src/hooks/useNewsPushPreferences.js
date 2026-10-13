import { useEffect } from 'react';
import { newsApi } from '../api/client';
import { loadNotificationPreferences } from '../lib/notificationPreferences';
import { newsPushPreferences } from '../lib/newsPushPreferences';

export default function useNewsPushPreferences(userId, authLoading) {
  useEffect(() => {
    if (authLoading || !userId) return;
    let cancelled = false;
    const sync = () => {
      if (cancelled) return;
      newsApi.saveNewsPushPreferences(newsPushPreferences(loadNotificationPreferences(userId)))
        .catch(() => { /* Explicit saves report failure; startup must remain usable offline. */ });
    };
    const resume = () => { if (document.visibilityState === 'visible') sync(); };
    sync();
    window.addEventListener('smarty-notification-preferences-changed', sync);
    document.addEventListener('visibilitychange', resume);
    return () => { cancelled = true;
      window.removeEventListener('smarty-notification-preferences-changed', sync);
      document.removeEventListener('visibilitychange', resume); };
  }, [userId, authLoading]);
}
