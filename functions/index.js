const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendTaskNotification = onDocumentCreated("tasks/{taskId}", async (event) => {
    const newTask = event.data.data();
    if (!newTask) return null;

    try {
        // 1. 抓取所有員工的 Token
        const userSnap = await admin.firestore().collection("users").get();
        const tokens = [];
        
        userSnap.forEach(doc => {
            const data = doc.data();
            // 排除發布者本人，且確保有 Token
            if (data.fcmToken && data.name !== newTask.creator) {
                tokens.push(data.fcmToken); 
            }
        });

        if (tokens.length > 0) {
            /**
             * 最終修正方案：回歸標準 Notification 模式
             * 這種寫法會讓手機作業系統 (iOS/Android) 
             * 繞過所有複雜的 Service Worker 邏輯，直接從最底層顯示標題與內容。
             */
            const message = {
                notification: {
                    title: `🚨 實驗室新任務`,
                    body: `${newTask.creator} 發布了：[${newTask.category}] ${newTask.clinic}`,
                },
                // Android 特定配置
                android: {
                    priority: 'high',
                    notification: {
                        title: `🚨 實驗室新任務`,
                        body: `${newTask.creator} 發布了：[${newTask.category}] ${newTask.clinic}`,
                        icon: 'stock_ticker_update',
                        color: '#f44336',
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK', // 雖然是 PWA，但有些舊版 Android 會參考此欄位
                        visibility: 'public', // 確保鎖定螢幕顯示內容
                        priority: 'high',
                    },
                },
                // Web/PWA 特定配置
                webpush: {
                    headers: {
                        Urgency: 'high'
                    },
                    notification: {
                        body: `${newTask.creator} 發布了：[${newTask.category}] ${newTask.clinic}`,
                        icon: 'https://modern-lab-app.web.app/logo192.png',
                        requireInteraction: true, // 保持通知直到使用者點擊
                    },
                    fcmOptions: {
                        link: "https://modern-lab-app.web.app"
                    }
                },
                data: {
                    title: `🚨 實驗室新任務`,
                    body: `${newTask.creator} 發布了：[${newTask.category}] ${newTask.clinic}`,
                    url: "https://modern-lab-app.web.app"
                },
                tokens: tokens, 
            };

            // 使用 sendEachForMulticast 進行多裝置發送
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`✅ 成功發送通知，成功數: ${response.successCount}`);
            
            if (response.failureCount > 0) {
                console.log(`⚠️ 失敗數: ${response.failureCount}，請檢查部分 Token 是否失效`);
            }
        }
        return null;
    } catch (error) {
        console.error("❌ 發送失敗:", error);
        return null;
    }
});