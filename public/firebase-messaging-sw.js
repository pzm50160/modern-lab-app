// Version: 2026.03.09.03 (版本號更新，確保觸發 App.js 檢查)

// 1. 強制立即更新機制：讓新版 SW 下載後不必等待，直接取代舊版
self.addEventListener('install', () => {
  self.skipWaiting(); // 跳過等待期，直接進入 active 狀態
});

self.addEventListener('activate', (event) => {
  // 讓新版 SW 立刻控制所有開啟的視窗，並清理舊快取
  event.waitUntil(clients.claim()); 
});

// 2. 引入 Firebase 庫
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
 * 監聽背景訊息
 * 搭配 Cloud Functions 的 Data 模式，確保背景接收唯一通知。
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] 收到背景數據訊息: ', payload);

  // 統一從 data 欄位抓取，因為我們 Cloud Functions 已改為 data 模式
  const title = payload.data?.title || "🚨 實驗室新任務";
  const body = payload.data?.body || "收到新任務，請進入 App 查看";

  const notificationOptions = {
    body: body,
    icon: '/logo192.png',
    tag: 'task-notification', // 同標籤覆蓋關鍵：相同標籤只會顯示最後一個，徹底解決「響兩聲」
    renotify: true,           // tag 相同時依然觸發震動/聲響
    data: {
      url: 'https://modern-lab-app.web.app'
    }
  };

  return self.registration.showNotification(title, notificationOptions);
});

// 4. 監聽通知點擊事件：點擊後自動跳轉回網頁
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 如果已經開著 App，就直接聚焦到該頁面
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      // 如果沒開 App，就新開一個視窗
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});