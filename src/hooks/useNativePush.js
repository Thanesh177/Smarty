import { useEffect } from 'react';
import { userApi } from '../api/client';
import { nativeNotificationRequest, supportsNativeReminders } from '../lib/nativeNotifications';
import { getUserScope } from '../lib/userScopedStorage';
import { loadNotificationPreferences } from '../lib/notificationPreferences';
import { reminderTime } from '../lib/dailyReminder';

// The native SDK owns registration and rotation; the authenticated API owns
// account binding. Neither the token nor a provider response is logged/stored.
export default function useNativePush(userId, authLoading) {
  useEffect(() => {
    if (authLoading || !supportsNativeReminders() || window.__SMARTY_NATIVE_PUSH__ !== true) return;
    let cancelled = false, inFlight = false, timer, lastToken;
    const scope = getUserScope(userId);
    const connect = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const preferences = loadNotificationPreferences(userId);
        await nativeNotificationRequest('configure', { userScope: scope, time: reminderTime(preferences) });
        if (cancelled || !userId) return;
        const result = await nativeNotificationRequest('push-token', { userScope: scope });
        if (cancelled) return;
        if (typeof result.token === 'string' && result.token.length > 20 && result.token.length <= 4096) {
          if (lastToken !== result.token) {
            await userApi.savePushToken(result.token, 'ios');
            if (!cancelled) lastToken = result.token;
          }
          window.dispatchEvent(new CustomEvent('smarty-native-push-status', { detail: { connected: true } }));
        } else {
          window.dispatchEvent(new CustomEvent('smarty-native-push-status', { detail: { connected: false, permission: result.permission } }));
        }
      } catch {
        if (!cancelled) window.dispatchEvent(new CustomEvent('smarty-native-push-status', { detail: { connected: false } }));
      } finally { inFlight = false; }
    };
    const resume = () => { if (document.visibilityState === 'visible') connect(); };
    const opened = event => {
      if (!userId || event.detail?.userId !== userId) return;
      window.dispatchEvent(new CustomEvent('smarty-notification-open', { detail: event.detail }));
    };
    window.addEventListener('smarty-native-push-ready', connect);
    window.addEventListener('smarty-native-push-open', opened);
    window.addEventListener('smarty-notification-preferences-changed', connect);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    queueMicrotask(connect);
    // APNs registration can complete after the first web request. One bounded
    // retry covers that race without a polling loop or an automatic prompt.
    timer = window.setTimeout(connect, 5000);
    return () => {
      cancelled = true; window.clearTimeout(timer);
      window.removeEventListener('smarty-native-push-ready', connect);
      window.removeEventListener('smarty-native-push-open', opened);
      window.removeEventListener('smarty-notification-preferences-changed', connect);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [userId, authLoading]);
}
