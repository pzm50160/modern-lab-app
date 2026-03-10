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
                // 保險起見，data 也放一份內容，確保舊版 SW 或特定平台也能讀到
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