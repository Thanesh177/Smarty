importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCN1HxV4Rvvgdz8fqH40rH23L-JXtDjX3c",
  authDomain: "smarty-c17cf.firebaseapp.com",
  projectId: "smarty-c17cf",
  storageBucket: "smarty-c17cf.firebasestorage.app",
  messagingSenderId: "780824147627",
  appId: "1:780824147627:web:1f15cf1adbda990ca4e9ee",
  measurementId: "G-11J4F0N4V1"
});


const messaging = firebase.messaging();

const NOTIFICATION_DB = 'smarty-notification-settings';
const NOTIFICATION_STORE = 'preferences';

const DEFAULT_PREFERENCES = {
  enabled: true,
  smartDelivery: true,
  showPreviews: true,
  quietHours: { enabled: true, start: '22:00', end: '07:30' },
  categories: {
    messages: true,
    social: true,
    learning: true,
    news: true,
    product: false,
  },
};

function openPreferenceDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOTIFICATION_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(NOTIFICATION_STORE)) {
        request.result.createObjectStore(NOTIFICATION_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePreferences(preferences) {
  const database = await openPreferenceDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(NOTIFICATION_STORE, 'readwrite');
    transaction.objectStore(NOTIFICATION_STORE).put(preferences, 'active');
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function loadPreferences() {
  try {
    const database = await openPreferenceDatabase();
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction(NOTIFICATION_STORE, 'readonly');
      const request = transaction.objectStore(NOTIFICATION_STORE).get('active');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();

    return {
      ...DEFAULT_PREFERENCES,
      ...(value || {}),
      quietHours: {
        ...DEFAULT_PREFERENCES.quietHours,
        ...(value?.quietHours || {}),
      },
      categories: {
        ...DEFAULT_PREFERENCES.categories,
        ...(value?.categories || {}),
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function classifyNotification(detail) {
  const searchable = [detail.type, detail.category, detail.title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/security|safety|account|moderation|password|login/.test(searchable)) return 'safety';
  if (/chat|message|direct_message|room_message/.test(searchable)) return 'messages';
  if (/follow|like|comment|mention|reply|invite|social/.test(searchable)) return 'social';
  if (/quiz|lesson|learning|progress|streak|topic|review/.test(searchable)) return 'learning';
  if (/news|briefing|digest|headline/.test(searchable)) return 'news';
  return 'product';
}

function isQuietTime(preferences) {
  if (!preferences.smartDelivery || !preferences.quietHours?.enabled) return false;

  const toMinutes = (value) => {
    const parts = String(value || '').split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(preferences.quietHours.start);
  const end = toMinutes(preferences.quietHours.end);

  if (start === end) return true;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

function shouldDeliver(detail, preferences) {
  if (!preferences.enabled) return false;

  const category = classifyNotification(detail);
  if (category !== 'safety' && preferences.categories?.[category] === false) return false;

  const immediate = category === 'safety' || category === 'messages';
  return immediate || !isQuietTime(preferences);
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SMARTY_NOTIFICATION_PREFERENCES') return;
  event.waitUntil(savePreferences(event.data.preferences || DEFAULT_PREFERENCES));
});

messaging.onBackgroundMessage(async (payload) => {
  const data = payload.data || {};
  const detail = {
    title: data.title || payload.notification?.title || 'Smarty',
    body: data.body || payload.notification?.body || 'You have a new update.',
    type: data.type || data.category || 'product',
    category: data.category,
  };
  const preferences = await loadPreferences();

  if (!shouldDeliver(detail, preferences)) return;

  const category = classifyNotification(detail);
  const body = !preferences.showPreviews && category === 'messages'
    ? 'You have a new message.'
    : detail.body;

  await self.registration.showNotification(detail.title, {

    body,

    icon: '/icon-192.png',

    badge: '/icon-192.png',

    tag: data.notificationId || data.messageId || `smarty-${category}`,

    renotify: false,

    data,

  });

});

self.addEventListener('notificationclick', function (event) {

  event.notification.close();

  const data = event.notification.data || {};

  const url = data.url || '/feed';

  event.waitUntil((async () => {
    const target = new URL(url, self.location.origin).href;
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));

    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }

    return clients.openWindow(target);
  })());

});
