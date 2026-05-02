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

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/logo192.png',
  });
});