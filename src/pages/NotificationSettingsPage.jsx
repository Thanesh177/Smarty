import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellRing, BrainCircuit, MessageCircle, Newspaper, Sparkles, Users, Clock3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationApi } from '../api/client';
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '../lib/notificationPreferences';
import { nextReminderAt, reminderTime } from '../lib/dailyReminder';
import { getUserScope } from '../lib/userScopedStorage';
import { nativeNotificationRequest, supportsNativeReminders } from '../lib/nativeNotifications';
import './NotificationSettingsPage.css';

const CATEGORY_ROWS = [
  {
    key: 'messages',
    title: 'Messages',
    description: 'Direct messages and active conversations stay immediate.',
    icon: MessageCircle,
  },
  {
    key: 'social',
    title: 'People and rooms',
    description: 'Replies, follows, mentions, and room invitations.',
    icon: Users,
  },
  {
    key: 'learning',
    title: 'Learning',
    description: 'Reviews, quiz reminders, streaks, and topic progress.',
    icon: BrainCircuit,
  },
  {
    key: 'news',
    title: 'Daily briefing',
    description: 'Important updates from your chosen countries and topics.',
    icon: Newspaper,
  },
  {
    key: 'product',
    title: 'Smarty updates',
    description: 'Occasional feature announcements and product guidance.',
    icon: Sparkles,
  },
];

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      className={`notification-toggle${checked ? ' is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function getPermissionStatus() {
  if (!('Notification' in window)) return 'unavailable';
  return Notification.permission;
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const userId = user?.userId || user?.sub || user?.id || '';
  const [preferences, setPreferences] = useState(() => loadNotificationPreferences(userId));
  const [saved, setSaved] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState(getPermissionStatus);
  const [error, setError] = useState('');
  const [reminderStatus, setReminderStatus] = useState(null);
  const savedTimer = useRef(null);
  const mounted = useRef(true);
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const native = supportsNativeReminders();

  useEffect(() => {
    setPreferences(loadNotificationPreferences(userId));
    setSaved(false); setError(''); setSaving(false); setEnabling(false);
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; window.clearTimeout(savedTimer.current); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const update = () => {
      if (native) nativeNotificationRequest('status').then(result => {
        if (!cancelled) { setPermission(result.permission); setReminderStatus(result); }
      }).catch(() => { if (!cancelled) setError('Could not read device settings. Try again.'); });
      else setPermission(getPermissionStatus());
    };
    const resume = () => { if (document.visibilityState === 'visible') update(); };
    update();
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      cancelled = true; window.clearTimeout(savedTimer.current);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [native, userId]);

  const permissionCopy = useMemo(() => {
    if (permission === 'granted') return 'Enabled on this device';
    if (permission === 'denied') return 'Blocked in device settings';
    if (permission === 'unavailable') return 'Managed by your device';
    return 'Not enabled on this device';
  }, [permission]);

  const updatePreference = (key, value) => {
    setSaved(false);
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const updateCategory = (key, value) => {
    setSaved(false);
    setPreferences((current) => ({
      ...current,
      categories: { ...current.categories, [key]: value },
    }));
  };

  const updateQuietHours = (key, value) => {
    setSaved(false);
    setPreferences((current) => ({
      ...current,
      quietHours: { ...current.quietHours, [key]: value },
    }));
  };

  const updateReminder = (key, value) => {
    setSaved(false);
    setPreferences(current => ({ ...current, dailyReminder: { ...current.dailyReminder, [key]: value } }));
  };

  const handleSave = async () => {
    if (saving || !userId) return;
    setSaving(true);
    setError('');
    try {
    const stored = saveNotificationPreferences(userId, preferences);
    setPreferences(stored);
    if (native) {
      try {
        const result = await nativeNotificationRequest('configure', { userScope: getUserScope(userId), time: reminderTime(stored) });
        if (!mounted.current || activeUser.current !== userId) return;
        setPermission(result.permission); setReminderStatus(result);
      } catch (cause) { if (mounted.current && activeUser.current === userId) setError(cause.message); return; }
    }
    setSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 2200);
    } finally { if (mounted.current && activeUser.current === userId) setSaving(false); }
  };

  const handleEnableDevice = async () => {
    if (enabling || permission === 'denied') return;
    setEnabling(true);
    setError('');

    try {
      if (native) {
        const result = await nativeNotificationRequest('enable');
        if (!mounted.current || activeUser.current !== userId) return;
        setPermission(result.permission);
        const stored = loadNotificationPreferences(userId);
        const status = await nativeNotificationRequest('configure', { userScope: getUserScope(userId), time: reminderTime(stored) });
        if (mounted.current && activeUser.current === userId) setReminderStatus(status);
      } else {
        const registered = await notificationApi.initPush(user, { delayMs: 0 });
        if (!mounted.current || activeUser.current !== userId) return;
        setPermission(getPermissionStatus());
        if (!registered && getPermissionStatus() === 'granted') setError('Permission is enabled, but push setup could not finish. Try again.');
      }
    } catch (cause) { if (mounted.current && activeUser.current === userId) setError(cause.message || 'Could not enable notifications. Please try again.');
    } finally {
      if (mounted.current && activeUser.current === userId) setEnabling(false);
    }
  };

  return (
    <main className="notification-settings-page">
      <section className="notification-settings-hero">
        <span className="notification-settings-kicker">NOTIFICATIONS</span>
        <h1>Useful, not noisy.</h1>
        <p>
          Choose what deserves your attention. Messages and safety alerts remain timely;
          everything else can respect your pace.
        </p>
      </section>

      <section className="notification-settings-shell" aria-label="Notification preferences">
        <div className="notification-master-card">
          <span className="notification-setting-icon"><BellRing size={20} /></span>
          <div>
            <strong>Allow Smarty notifications</strong>
            <p>Control all optional notifications from one place.</p>
          </div>
          <Toggle
            checked={preferences.enabled}
            onChange={(value) => updatePreference('enabled', value)}
            label="Allow Smarty notifications"
          />
        </div>

        <div className="notification-device-row">
          <div>
            <span className={`notification-device-dot is-${permission}`} />
            <strong>{permissionCopy}</strong>
          </div>
          {['default', 'granted'].includes(permission) && (
            <button type="button" onClick={handleEnableDevice} disabled={enabling}>
              {enabling ? 'Connecting…' : permission === 'granted' ? 'Reconnect' : 'Enable device'}
            </button>
          )}
        </div>

        {error && <p className="notification-settings-error" role="alert">{error}</p>}
        {permission === 'denied' && <p className="notification-settings-note">Allow notifications for Smarty in your device or browser settings, then return here.</p>}

        <section className="notification-settings-group" aria-label="Daily learning reminder">
          <div className="notification-category-row">
            <span className="notification-setting-icon"><Clock3 size={18} /></span>
            <div><strong>A moment to learn</strong><p>One gentle reminder each day. Revisit a lesson or discover something new.</p></div>
            <Toggle checked={preferences.dailyReminder.enabled} onChange={value => updateReminder('enabled', value)}
              label="Daily learning reminder" disabled={!preferences.enabled || !preferences.categories.learning} />
          </div>
          <div className="notification-reminder-details">
            <label><span>Remind me at</span><input type="time" value={preferences.dailyReminder.time}
              onChange={event => updateReminder('time', event.target.value)}
              disabled={!preferences.enabled || !preferences.categories.learning || !preferences.dailyReminder.enabled} /></label>
            <p>{native
              ? 'Device reminders work even when Smarty is closed. Enable device notifications and save your preference.'
              : 'Reminds you while Smarty is open. Closed-app daily reminders require the updated iPhone/iPad app.'}</p>
            {preferences.dailyReminder.enabled && reminderTime(preferences) !== preferences.dailyReminder.time && <small>
              {reminderTime(preferences) ? `Quiet hours move your reminder to ${reminderTime(preferences)}.` : 'Your reminder is paused by notification or quiet-hours settings.'}
            </small>}
            {saved && native && reminderStatus?.scheduled && <small role="status">Daily device reminder scheduled.</small>}
            {saved && native && reminderTime(preferences) && !reminderStatus?.scheduled && <small role="status">Saved. Enable notifications on this device to schedule your reminder.</small>}
            {!native && nextReminderAt(preferences) && <small>Next reminder time: {nextReminderAt(preferences).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, in your local time.</small>}
          </div>
        </section>

        <div className="notification-settings-group">
          <div className="notification-group-heading">
            <span>What reaches you</span>
            <small>Safety notices are always available inside Smarty.</small>
          </div>

          <div className="notification-category-list">
            {CATEGORY_ROWS.map(({ key, title, description, icon: Icon }) => (
              <div className="notification-category-row" key={key}>
                <span className="notification-setting-icon"><Icon size={18} /></span>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
                <Toggle
                  checked={preferences.categories[key]}
                  onChange={(value) => updateCategory(key, value)}
                  label={`${title} notifications`}
                  disabled={!preferences.enabled}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="notification-settings-group notification-delivery-group">
          <div className="notification-group-heading">
            <span>Smart delivery</span>
            <small>Reduce interruptions without missing conversations.</small>
          </div>

          <div className="notification-compact-row">
            <div>
              <strong>Quiet non-urgent alerts</strong>
              <p>Messages remain immediate; non-urgent popups are paused.</p>
            </div>
            <Toggle
              checked={preferences.smartDelivery}
              onChange={(value) => updatePreference('smartDelivery', value)}
              label="Smart delivery"
              disabled={!preferences.enabled}
            />
          </div>

          <div className="notification-compact-row notification-quiet-row">
            <div>
              <strong>Quiet hours</strong>
              <p>Pause non-urgent interruptions during this time.</p>
            </div>
            <Toggle
              checked={preferences.quietHours.enabled}
              onChange={(value) => updateQuietHours('enabled', value)}
              label="Quiet hours"
              disabled={!preferences.enabled || !preferences.smartDelivery}
            />
            <div className="notification-time-fields">
              <label>
                <span>From</span>
                <input
                  type="time"
                  value={preferences.quietHours.start}
                  onChange={(event) => updateQuietHours('start', event.target.value)}
                  disabled={!preferences.enabled || !preferences.smartDelivery || !preferences.quietHours.enabled}
                />
              </label>
              <label>
                <span>Until</span>
                <input
                  type="time"
                  value={preferences.quietHours.end}
                  onChange={(event) => updateQuietHours('end', event.target.value)}
                  disabled={!preferences.enabled || !preferences.smartDelivery || !preferences.quietHours.enabled}
                />
              </label>
            </div>
          </div>

          <div className="notification-compact-row">
            <div>
              <strong>Message previews</strong>
              <p>Show message text in notification previews on this device.</p>
            </div>
            <Toggle
              checked={preferences.showPreviews}
              onChange={(value) => updatePreference('showPreviews', value)}
              label="Message previews"
              disabled={!preferences.enabled || !preferences.categories.messages}
            />
          </div>
        </div>

        <div className="notification-save-bar">
          <span>{saved ? 'Preferences saved' : 'Changes stay private to your account on this device.'}</span>
          <button type="button" onClick={handleSave} disabled={saving}>
            <Bell size={17} />
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save preferences'}
          </button>
        </div>
      </section>
    </main>
  );
}
