const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// 監控 tasks 集合的新增事件
exports.sendTaskNotification = functions.firestore
    .document("tasks/{taskId}")
    .onCreate(async (snap, context) => {
        const newTask = snap.data();
        
        // 1. 設定通知內容
        const payload = {
            notification: {
                title: `🚨 實驗室新任務：[${newTask.category}]`,
                body: `${newTask.clinic} - 由 ${newTask.creator} 發布`,
                clickAction: "FLUTTER_NOTIFICATION_CLICK", // 確保手機點擊後開啟 App
            }
        };

        try {
            // 2. 找出所有具備 Token 的其他員工
            const userSnap = await admin.firestore().collection("users").get();
            const tokens = [];
            
            userSnap.forEach(doc => {
                const data = doc.data();
                // 排除發布者本人
                if (data.fcmToken && data.name !== newTask.creator) {
                    tokens.push(data.fcmToken);
                }
            });

            if (tokens.length === 0) return null;

            // 3. 透過管理權限發送推播 (這不會有 CORS 問題)
            const response = await admin.messaging().sendToDevice(tokens, payload);
            console.log(`成功發送給 ${response.successCount} 個裝置`);
            return null;
        } catch (error) {
            console.error("發送失敗:", error);
            return null;
        }
    });