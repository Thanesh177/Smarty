import { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, BrainCircuit, MessageCircle, Newspaper, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationApi } from '../api/client';
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '../lib/notificationPreferences';
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
  const [permission, setPermission] = useState(getPermissionStatus);

  useEffect(() => {
    setPreferences(loadNotificationPreferences(userId));
  }, [userId]);

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

  const handleSave = () => {
    const stored = saveNotificationPreferences(userId, preferences);
    setPreferences(stored);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const handleEnableDevice = async () => {
    if (enabling || permission === 'denied') return;
    setEnabling(true);

    try {
      await notificationApi.initPush(user, { delayMs: 0 });
      setPermission(getPermissionStatus());
    } finally {
      setEnabling(false);
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
          {permission === 'default' && (
            <button type="button" onClick={handleEnableDevice} disabled={enabling}>
              {enabling ? 'Enabling…' : 'Enable device'}
            </button>
          )}
        </div>

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
              <p>Messages remain immediate; learning, news, and social alerts wait.</p>
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
                  disabled={!preferences.enabled || !preferences.quietHours.enabled}
                />
              </label>
              <label>
                <span>Until</span>
                <input
                  type="time"
                  value={preferences.quietHours.end}
                  onChange={(event) => updateQuietHours('end', event.target.value)}
                  disabled={!preferences.enabled || !preferences.quietHours.enabled}
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
          <button type="button" onClick={handleSave}>
            <Bell size={17} />
            {saved ? 'Saved' : 'Save preferences'}
          </button>
        </div>
      </section>
    </main>
  );
}
