const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendTaskNotification = onDocumentCreated("tasks/{taskId}", async (event) => {
    const newTask = event.data.data();
    if (!newTask) return null;

    try {
        // 1. 抓取所有員工的 Token
        const userSnap = await admin.firestore().collection("users").get();
        
        // 使用 Set 來自動過濾掉重複的 Token
        const tokenSet = new Set();
        
        userSnap.forEach(doc => {
          const data = doc.data();
          // 排除發布者本人，且確保有 Token
          if (data.fcmToken && data.name !== newTask.creator) {
            tokenSet.add(data.fcmToken); 
          }
        });

        // 將 Set 轉回陣列
        const finalTokens = Array.from(tokenSet);

        if (finalTokens.length > 0) {
            // 2. 建立單一通知物件
            const message = {
                notification: {
                    title: `🚨 實驗室新任務`,
                    body: `${newTask.creator} 發布了：[${newTask.category}] ${newTask.clinic}`,
                },
                // 這是發送給多個人的標準用法
                tokens: finalTokens, 
            };

            // 3. 只執行一次發送指令
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`✅ 成功通知 ${response.successCount} 台裝置，ID: ${event.params.taskId}`);
        }
        return null;
    } catch (error) {
        console.error("❌ 發送失敗:", error);
        return null;
    }
});