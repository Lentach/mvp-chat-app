// Firebase background message handler for web push notifications.
// This service worker is automatically registered by the firebase_messaging plugin.
// It MUST be served from the root path (/) — placing it in /web/ satisfies this.
//
// TODO: Replace the firebaseConfig values below with your real values from:
// Firebase Console → Project Settings → Your web app → SDK setup and configuration

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'TODO_REPLACE_WITH_REAL_API_KEY',
  authDomain: 'TODO_REPLACE.firebaseapp.com',
  projectId: 'TODO_REPLACE_WITH_REAL_PROJECT_ID',
  storageBucket: 'TODO_REPLACE.firebasestorage.app',
  messagingSenderId: 'TODO_REPLACE_WITH_REAL_SENDER_ID',
  appId: 'TODO_REPLACE_WITH_REAL_APP_ID',
});

const messaging = firebase.messaging();

// Background push handler — wakes the browser when a push arrives while closed.
// Privacy: payload only contains { type: 'new_message' } — no message content.
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification('MVP Chat', {
    body: 'You have a new message',
    icon: '/icons/Icon-192.png',
    badge: '/icons/Icon-192.png',
    tag: 'new-message', // Replaces previous notification instead of stacking
    data: payload.data,
  });
});
