import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyCN1HxV4Rvvgdz8fqH40rH23L-JXtDjX3c',
  authDomain: 'smarty-c17cf.firebaseapp.com',
  projectId: 'smarty-c17cf',
  storageBucket: 'smarty-c17cf.firebasestorage.app',
  messagingSenderId: '780824147627',
  appId: '1:780824147627:web:1f15cf1adbda990ca4e9ee',
  measurementId: 'G-11J4F0N4V1',
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

export async function requestNotificationToken() {
  const permission = await Notification.requestPermission();

  if (permission !== 'granted') return null;

  return getToken(messaging, {
    vapidKey:
      'BKyUg8B4BnFUUE4zMQMJko8Czw71f-TJw6HakyNRp9nZGam42tR7R6N7vwC4SZY3Avs2-PAM117y_2RZ9ZvPp78',
  });
}

// 🔥 Android WebView push token bridge
export function setupAndroidPushTokenListener() {
  window.saveAndroidPushToken = async (token) => {
    if (!token) return;

    try {
      const { userApi } = await import('./api/client.js');

      await userApi.savePushToken(token, 'android');

      console.log('✅ Android push token saved:', token);
    } catch (err) {
      console.error('❌ Failed to save Android token:', err);
    }
  };

  // Token injected early from Android
  if (window.__ANDROID_FCM_TOKEN__) {
    window.saveAndroidPushToken(window.__ANDROID_FCM_TOKEN__);
  }

  // Token fetched via JS bridge
  if (window.AndroidBridge?.getFcmToken) {
    const token = window.AndroidBridge.getFcmToken();
    if (token) window.saveAndroidPushToken(token);
  }
}
export function listenForForegroundMessages() {
  return onMessage(messaging, async (payload) => {
    console.log('Foreground push received:', payload);
    console.log('Notification permission:', Notification.permission);

    const title =
      payload.data?.title ||
      payload.notification?.title ||
      'Smarty';

    const body =
      payload.data?.body ||
      payload.notification?.body ||
      'You have a new notification.';

    if (Notification.permission !== 'granted') {
      console.warn('Notifications are not granted');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      await registration.showNotification(title, {
        body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        data: payload.data || {},
      });

      console.log('Foreground notification shown');
    } catch (err) {
      console.error('Foreground notification failed:', err);

      new Notification(title, {
        body,
        icon: '/logo192.png',
        data: payload.data || {},
      });
    }
  });
}