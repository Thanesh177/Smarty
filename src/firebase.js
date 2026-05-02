import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCN1HxV4Rvvgdz8fqH40rH23L-JXtDjX3c",
  authDomain: "smarty-c17cf.firebaseapp.com",
  projectId: "smarty-c17cf",
  storageBucket: "smarty-c17cf.firebasestorage.app",
  messagingSenderId: "780824147627",
  appId: "1:780824147627:web:1f15cf1adbda990ca4e9ee",
  measurementId: "G-11J4F0N4V1"
};

const app = initializeApp(firebaseConfig);

export const messaging = getMessaging(app);

export async function requestNotificationToken() {
  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    return null;
  }

  const token = await getToken(messaging, {
    vapidKey: "BKyUg8B4BnFUUE4zMQMJko8Czw71f-TJw6HakyNRp9nZGam42tR7R6N7vwC4SZY3Avs2-PAM117y_2RZ9ZvPp78",
  });

  return token;
}

export function listenForForegroundMessages(callback) {
  return onMessage(messaging, callback);
}