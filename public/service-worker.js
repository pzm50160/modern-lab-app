/* eslint-disable no-restricted-globals */

// 安裝與啟用邏輯保持不變
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- 新增：處理 Push 事件 ---
self.addEventListener('push', (event) => {
  let data = { title: '新任務通知', body: '你有一個新的待處理任務！' };

  // 如果 Firebase 傳來 JSON 資料，則解析它
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/logo192.png',      // 通知的小圖示
    badge: '/favicon.ico',     // 手機上方狀態列的小圖示
    vibrate: [200, 100, 200], // 震動模式
    data: {
      url: '/' // 點擊通知後要開啟的網址
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// --- 新增：處理通知點擊事件 ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // 點擊後關閉通知視窗
  event.waitUntil(
    clients.openWindow(event.notification.data.url) // 開啟 App
  );
});