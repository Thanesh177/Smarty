import { initializeApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyCN1HxV4Rvvgdz8fqH40rH23L-JXtDjX3c',
  authDomain: 'smarty-c17cf.firebaseapp.com',
  projectId: 'smarty-c17cf',
  storageBucket: 'smarty-c17cf.firebasestorage.app',
  messagingSenderId: '780824147627',
  appId: '1:780824147627:web:1f15cf1adbda990ca4e9ee',
  measurementId: 'G-11J4F0N4V1',
};

const firebaseApp = initializeApp(firebaseConfig);

let messagingInstance = null;

function isSmartyIOSApp() {
  return Boolean(
    window.__SMARTY_NATIVE_APP__ === true ||
      window.__SMARTY_PLATFORM__ === 'ios' ||
      window.__SMARTY_IS_NATIVE_APP__ === true
  );
}

function dispatchSmartyForegroundNotification(detail) {
  window.dispatchEvent(
    new CustomEvent('smarty-notification', {
      detail,
    })
  );
}

async function getFirebaseMessaging() {
  if (messagingInstance) {
    return messagingInstance;
  }

  // Firebase Web Messaging must not initialize inside the iOS WKWebView.
  // Native iOS push notifications should be handled by APNs/FCM in Swift.
  if (isSmartyIOSApp()) {
    console.info(
      '[Firebase Messaging] Skipped inside the Smarty iOS app.'
    );

    return null;
  }

  try {
    const supported = await isSupported();

    if (!supported) {
      console.info(
        '[Firebase Messaging] This browser does not support web push.'
      );

      return null;
    }

    messagingInstance = getMessaging(firebaseApp);

    return messagingInstance;
  } catch (error) {
    console.warn(
      '[Firebase Messaging] Support check failed:',
      error
    );

    return null;
  }
}

export async function requestNotificationToken() {
  if (isSmartyIOSApp()) {
    console.info(
      '[Firebase Messaging] Web token request skipped on iOS native.'
    );

    return null;
  }

  if (!('Notification' in window)) {
    console.info(
      '[Firebase Messaging] Notification API is unavailable.'
    );

    return null;
  }

  if (!('serviceWorker' in navigator)) {
    console.info(
      '[Firebase Messaging] Service workers are unavailable.'
    );

    return null;
  }

  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.info(
        '[Firebase Messaging] Notification permission was not granted.'
      );

      return null;
    }

    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey:
        'BKyUg8B4BnFUUE4zMQMJko8Czw71f-TJw6HakyNRp9nZGam42tR7R6N7vwC4SZY3Avs2-PAM117y_2RZ9ZvPp78',
      serviceWorkerRegistration: registration,
    });

    return token || null;
  } catch (error) {
    console.error(
      '[Firebase Messaging] Failed to request token:',
      error
    );

    return null;
  }
}

// Android WebView push-token bridge
export function setupAndroidPushTokenListener() {
  window.saveAndroidPushToken = async (token) => {
    if (!token) {
      return;
    }

    try {
      const { userApi } = await import('./api/client.js');

      await userApi.savePushToken(token, 'android');

      console.log('Android push token saved.');
    } catch (error) {
      console.error(
        'Failed to save Android push token:',
        error
      );
    }
  };

  // Token injected early by Android.
  if (window.__ANDROID_FCM_TOKEN__) {
    window.saveAndroidPushToken(
      window.__ANDROID_FCM_TOKEN__
    );
  }

  // Token requested through the Android JavaScript bridge.
  if (window.AndroidBridge?.getFcmToken) {
    try {
      const token = window.AndroidBridge.getFcmToken();

      if (token) {
        window.saveAndroidPushToken(token);
      }
    } catch (error) {
      console.error(
        'Failed to get Android FCM token:',
        error
      );
    }
  }
}

export async function listenForForegroundMessages() {
  const messaging = await getFirebaseMessaging();

  if (!messaging) {
    // Return a no-op unsubscribe function.
    return () => {};
  }

  return onMessage(messaging, async (payload) => {
    console.log('Foreground push received:', payload);

    const title =
      payload.data?.title ||
      payload.notification?.title ||
      'Smarty';

    const body =
      payload.data?.body ||
      payload.notification?.body ||
      'You have a new notification.';

    const url = payload.data?.url || '/';
    const type = payload.data?.type || 'general';

    dispatchSmartyForegroundNotification({
      title,
      body,
      url,
      type,
      rawPayload: payload,
    });

    if (document.visibilityState === 'visible') {
      return;
    }

    if (
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      console.warn('Notifications are not granted.');

      return;
    }

    try {
      if ('serviceWorker' in navigator) {
        const registration =
          await navigator.serviceWorker.ready;

        await registration.showNotification(title, {
          body,
          icon: '/logo192.png',
          badge: '/logo192.png',
          data: payload.data || {},
        });

        console.log(
          'Notification shown through service worker.'
        );

        return;
      }

      new Notification(title, {
        body,
        icon: '/logo192.png',
        data: payload.data || {},
      });
    } catch (error) {
      console.error(
        'Foreground notification fallback failed:',
        error
      );

      try {
        new Notification(title, {
          body,
          icon: '/logo192.png',
          data: payload.data || {},
        });
      } catch (notificationError) {
        console.error(
          'Direct notification also failed:',
          notificationError
        );
      }
    }
  });
}