importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// 初始化 Firebase
firebase.initializeApp({
  apiKey: "AIzaSyCaxWnFi78Rrra5gEuFRWPN-4jdEUFWLp8",
  projectId: "modern-lab-app",
  messagingSenderId: "154018152899",
  appId: "1:154018152899:web:21c8435ed7e68221b13d76"
});

const messaging = firebase.messaging();

/**
 * 監聽背景訊息
 * 當 App 在背景或關閉時收到推播，FCM 會自動根據 payload.notification 顯示通知。
 * 這裡只需保留監聽用於偵錯，不要再手動呼叫 showNotification 避免重複。
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 收到背景訊息 ', payload);
});