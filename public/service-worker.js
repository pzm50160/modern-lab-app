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
  let data = { 
    title: '🚨 實驗室新任務', 
    body: '你有一個新的待處理任務！',
    url: '/'
  };

  // 如果 Firebase 傳來資料，則解析它
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[sw.js] 收到 Push 封包:', payload);

      // 1. 優先從 notification 欄位提取內容 (Firebase 標準格式)
      if (payload.notification) {
        data.title = payload.notification.title || data.title;
        data.body = payload.notification.body || data.body;
      } 
      // 2. 備援：從 data 欄位提取內容 (有些自定義發送會放這)
      else if (payload.data) {
        data.title = payload.data.title || data.title;
        data.body = payload.data.body || data.body;
      }

      // 3. 提取跳轉連結
      if (payload.data && payload.data.url) {
        data.url = payload.data.url;
      }
    } catch (e) {
      console.error('[sw.js] 解析 JSON 失敗，改用純文字:', e);
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/logo192.png',      // 通知的小圖示
    badge: '/favicon1.ico',    // 手機上方狀態列的小圖示 (修正為正確檔名)
    vibrate: [200, 100, 200], // 震動模式
    data: {
      url: data.url
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