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
        const tokenToDocId = {}; // 記錄 Token 對應的 user doc ID，方便後續清理
        
        userSnap.forEach(doc => {
            const data = doc.data();
            // 排除發布者本人，且確保有 Token
            if (data.fcmToken && data.name !== newTask.creator) {
                tokens.push(data.fcmToken);
                tokenToDocId[data.fcmToken] = doc.id;
            }
        });

        if (tokens.length > 0) {
            const message = {
                notification: {
                    title: `🚨 實驗室新任務`,
                    body: `${newTask.creator} 發布了：[${newTask.category}] ${newTask.clinic}`,
                },
                android: {
                    priority: 'high',
                    notification: {
                        title: `🚨 實驗室新任務`,
                        body: `${newTask.creator} 發布了：[${newTask.category}] ${newTask.clinic}`,
                        icon: 'stock_ticker_update',
                        color: '#f44336',
                        visibility: 'public',
                        priority: 'high',
                    },
                },
                webpush: {
                    headers: {
                        Urgency: 'high'
                    },
                    notification: {
                        body: `${newTask.creator} 發布了：[${newTask.category}] ${newTask.clinic}`,
                        icon: 'https://modern-lab-app.web.app/logo192.png',
                        requireInteraction: true,
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

            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`✅ 成功發送通知，成功數: ${response.successCount}`);
            
            // 自動清理失效的 Token
            if (response.failureCount > 0) {
                const staleTokenCleanup = [];
                
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const errorCode = resp.error?.code;
                        console.log(`⚠️ Token 發送失敗 [${idx}]: ${errorCode} - ${resp.error?.message}`);
                        
                        // 這些錯誤代碼表示 Token 已經永久失效，應該清除
                        if (
                            errorCode === 'messaging/registration-token-not-registered' ||
                            errorCode === 'messaging/invalid-registration-token' ||
                            errorCode === 'messaging/invalid-argument'
                        ) {
                            const failedToken = tokens[idx];
                            const docId = tokenToDocId[failedToken];
                            if (docId) {
                                console.log(`🗑️ 清除失效 Token，使用者 doc: ${docId}`);
                                staleTokenCleanup.push(
                                    admin.firestore().collection("users").doc(docId).update({
                                        fcmToken: admin.firestore.FieldValue.delete(),
                                        lastTokenUpdate: admin.firestore.FieldValue.serverTimestamp()
                                    })
                                );
                            }
                        }
                    }
                });
                
                if (staleTokenCleanup.length > 0) {
                    await Promise.all(staleTokenCleanup);
                    console.log(`🧹 已清理 ${staleTokenCleanup.length} 個失效 Token`);
                }
            }
        }
        return null;
    } catch (error) {
        console.error("❌ 發送失敗:", error);
        return null;
    }
});