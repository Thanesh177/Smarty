importScripts('/notification-policy.js');

// Install our click handler before FCM's handler. A notification must never
// navigate this app to a third-party or script URL supplied in a payload.
self.addEventListener('notificationclick', event => {
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data || {};
    const payload = data.FCM_MSG?.data || data;
    const path = SmartyNotificationPolicy.safePath(payload.url, self.location.origin);
    const target = new URL(path, self.location.origin).href;
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(target);
      return existing.focus();
    }
    return clients.openWindow(target);
  })());
});

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

const DEFAULT_PREFERENCES = { ...SmartyNotificationPolicy.normalize(), enabled: false, userScope: 'anonymous' };
let activePreferences = null;
let preferenceWrite = Promise.resolve();

function openPreferenceDatabase() {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => { finished = true; reject(new Error('Notification storage timed out')); }, 1500);
    const request = indexedDB.open(NOTIFICATION_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(NOTIFICATION_STORE)) {
        request.result.createObjectStore(NOTIFICATION_STORE);
      }
    };
    request.onsuccess = () => {
      if (finished) return request.result.close();
      finished = true; clearTimeout(timer); resolve(request.result);
    };
    request.onerror = request.onblocked = () => {
      finished = true; clearTimeout(timer); reject(request.error || new Error('Notification storage unavailable'));
    };
  });
}

async function savePreferences(preferences) {
  const database = await openPreferenceDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(NOTIFICATION_STORE, 'readwrite');
    transaction.objectStore(NOTIFICATION_STORE).put(preferences, 'active');
    transaction.oncomplete = resolve;
    transaction.onerror = transaction.onabort = () => reject(transaction.error);
  });
  database.close();
}

async function loadPreferences() {
  if (activePreferences) return activePreferences;
  try {
    const database = await openPreferenceDatabase();
    const value = await new Promise((resolve, reject) => {
      const transaction = database.transaction(NOTIFICATION_STORE, 'readonly');
      const request = transaction.objectStore(NOTIFICATION_STORE).get('active');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();

    return activePreferences || (value ? { ...SmartyNotificationPolicy.normalize(value), userScope: value.userScope || 'anonymous' } : DEFAULT_PREFERENCES);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SMARTY_NOTIFICATION_PREFERENCES') return;
  activePreferences = event.data.preferences || DEFAULT_PREFERENCES;
  const value = activePreferences;
  preferenceWrite = preferenceWrite.then(() => savePreferences(value)).catch(() => {});
  event.waitUntil(preferenceWrite);
});

messaging.onBackgroundMessage(async (payload) => {
  // FCM already displays notification-bearing messages. Displaying a second
  // copy here caused duplicate alerts. Data-only pushes use our privacy policy.
  if (payload.notification) return;
  const data = payload.data || {};
  const detail = {
    title: data.title || payload.notification?.title || 'Smarty',
    body: data.body || payload.notification?.body || 'You have a new update.',
    type: data.type || data.category || 'product',
    category: data.category,
  };
  const preferences = await loadPreferences();

  if (preferences.userScope === 'anonymous') return;
  if (data.userId && encodeURIComponent(String(data.userId)) !== preferences.userScope) return;
  if (!SmartyNotificationPolicy.decision(detail, preferences).deliver) return;

  const category = SmartyNotificationPolicy.classify(detail);
  const body = SmartyNotificationPolicy.body(detail, preferences);

  await self.registration.showNotification(detail.title, {

    body,

    icon: '/icon-192.png',

    badge: '/icon-192.png',

    tag: data.notificationId || data.messageId || `smarty-${category}`,

    renotify: false,

    data: { ...data, url: SmartyNotificationPolicy.safePath(data.url, self.location.origin) },

  });

});
