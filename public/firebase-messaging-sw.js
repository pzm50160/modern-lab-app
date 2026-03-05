importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCaxWnFi78Rrra5gEuFRWPN-4jdEUFWLp8",
  projectId: "modern-lab-app",
  messagingSenderId: "154018152899",
  appId: "1:154018152899:web:21c8435ed7e68221b13d76"
});

const messaging = firebase.messaging();

// 監聽背景訊息
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 收到背景訊息 ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});