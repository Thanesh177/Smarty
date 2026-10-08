import { useEffect } from 'react';
import { activateNotificationPreferences, loadNotificationPreferences } from '../lib/notificationPreferences';
import { claimDailyReminder, learningReminder, nextReminderAt, reminderDue, reminderTime } from '../lib/dailyReminder';
import { getLearningLibrary } from '../lib/learningJourney';
import { getUserScope } from '../lib/userScopedStorage';
import { nativeNotificationRequest, supportsNativeReminders } from '../lib/nativeNotifications';

export default function useDailyReminder(userId, authLoading = false) {
  useEffect(() => {
    if (authLoading) return;
    let timer, cancelled = false;
    const native = supportsNativeReminders();
    const notify = detail => window.dispatchEvent(new CustomEvent('smarty-notification', { detail }));
    const open = event => {
      if (!userId || event.detail?.userScope !== getUserScope(userId)) return;
      claimDailyReminder(userId);
      window.dispatchEvent(new CustomEvent('smarty-notification-open', { detail: { url: '/learning' } }));
    };
    const foreground = event => {
      if (!userId || event.detail?.userScope !== getUserScope(userId) || !claimDailyReminder(userId)) return;
      notify(learningReminder(getLearningLibrary(userId)));
    };
    const schedule = async () => {
      if (cancelled) return;
      window.clearTimeout(timer);
      const preferences = activateNotificationPreferences(userId);
      if (native) {
        try {
          const result = await nativeNotificationRequest('configure', {
            userScope: preferences.userScope, time: reminderTime(preferences),
          });
          if (!cancelled) window.dispatchEvent(new CustomEvent('smarty-reminder-status', { detail: result }));
        } catch { /* Settings reports device errors when saved explicitly. */ }
        return;
      }
      // Browsers/older wrappers cannot schedule when closed. Run a single timer
      // while visible and resume on focus, not a polling loop in the background.
      if (!userId || document.visibilityState !== 'visible') return;
      const now = new Date();
      if (reminderDue(preferences, now)) {
        const deliver = () => {
          if (!cancelled && claimDailyReminder(userId, now)) notify(learningReminder(getLearningLibrary(userId), now));
        };
        if (navigator.locks?.request) {
          await navigator.locks.request(`smarty-daily-reminder:${getUserScope(userId)}`, { ifAvailable: true }, lock => { if (lock) deliver(); }).catch(() => {});
        } else deliver();
      }
      if (cancelled) return;
      const next = nextReminderAt(preferences, now);
      if (next) timer = window.setTimeout(schedule, Math.max(1000, next - now));
    };
    const resume = () => { if (document.visibilityState === 'visible') schedule(); else window.clearTimeout(timer); };
    const storage = event => { if (event.key?.startsWith('smarty_notification_preferences_v1:')) schedule(); };
    window.addEventListener('smarty-native-reminder-open', open);
    window.addEventListener('smarty-native-reminder', foreground);
    window.addEventListener('smarty-reminder-resume', schedule);
    window.addEventListener('smarty-notification-preferences-changed', schedule);
    window.addEventListener('focus', resume);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', resume);
    // Parent notification listeners must mount before a due reminder is claimed.
    queueMicrotask(schedule);
    return () => {
      cancelled = true; window.clearTimeout(timer);
      window.removeEventListener('smarty-native-reminder-open', open);
      window.removeEventListener('smarty-native-reminder', foreground);
      window.removeEventListener('smarty-reminder-resume', schedule);
      window.removeEventListener('smarty-notification-preferences-changed', schedule);
      window.removeEventListener('focus', resume);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [userId, authLoading]);
}
