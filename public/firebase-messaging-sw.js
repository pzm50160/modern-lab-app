// Version: 2026.03.10.RESET (版本號更新，強制員工手機下載新邏輯)

// 1. 強制立即更新機制
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); 
});

// 2. 引入 Firebase 庫 (相容模式)
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// 3. 初始化 Firebase
firebase.initializeApp({
  apiKey: "AIzaSyCaxWnFi78Rrra5gEuFRWPN-4jdEUFWLp8",
  projectId: "modern-lab-app",
  messagingSenderId: "154018152899",
  appId: "1:154018152899:web:21c8435ed7e68221b13d76"
});

const messaging = firebase.messaging();

/**
 * 核心修正：移除背景手動彈窗邏輯
 * 讓手機系統作業系統直接處理 Functions 傳來的 notification 欄位。
 * 這樣可以保證「診所名稱」與「發布者」100% 由系統正確顯示。
 */

// 4. 監聽通知點擊事件：負責點擊後跳轉回 App
self.addEventListener('notificationclick', (event) => {
  console.log('[sw.js] 通知被點擊');
  event.notification.close();
  
  // 優先從封包抓取網址，沒有則使用預設首頁
  const urlToOpen = event.notification.data?.url || 'https://modern-lab-app.web.app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 如果已經開著 App，就切換過去
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      // 如果沒開，就新開一個分頁
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});