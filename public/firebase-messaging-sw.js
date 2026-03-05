// Version: 2026.03.05.02 (每次部署請修改這個數字，觸發 App.js 的更新提示)

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
 * 當 App 關閉或在背景時，此處負責處理通知顯示。
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] 收到背景訊息: ', payload);

  // 優先抓取 data 欄位，若無則抓取 notification 欄位
  const title = payload.data?.title || payload.notification?.title || "🚨 實驗室新任務";
  const body = payload.data?.body || payload.notification?.body || "收到新任務，請進入 App 查看";

  const notificationOptions = {
    body: body,
    icon: '/logo192.png',
    tag: 'task-notification', // 關鍵：標籤覆蓋機制，防止重疊響兩聲
    renotify: true,           // 當有新訊息時，就算 tag 相同也會再次震動/發聲
    data: {
      url: 'https://modern-lab-app.web.app' // 點擊通知時跳轉的網址
    }
  };

  // 手動觸發彈窗，確保在 Data 模式下也能看到通知
  return self.registration.showNotification(title, notificationOptions);
});

// 監聽通知點擊事件：點擊後自動開啟 App 視窗
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // 關閉通知欄
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 如果已經開啟過網頁，就直接聚焦 (Focus)
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) return client.focus();
      }
      // 如果沒開啟過，就新開一個分頁
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});