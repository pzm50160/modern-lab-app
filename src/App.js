import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, serverTimestamp, getDocs, where } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// 已整合你的 API Key
const firebaseConfig = {
  apiKey: "AIzaSyCaxWnFi78Rrra5gEuFRWPN-4jdEUFWLp8",
  authDomain: "modern-lab-app.firebaseapp.com",
  projectId: "modern-lab-app",
  storageBucket: "modern-lab-app.firebasestorage.app",
  messagingSenderId: "154018152899",
  appId: "1:154018152899:web:21c8435ed7e68221b13d76"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

const getTaskCardColors = (cat, priority, isDeleted) => {
  if (isDeleted) return { bg: '#f5f5f5', border: '#d9d9d9', text: '#bfbfbf' };
  if (priority) return { bg: '#fff1f0', border: '#ff4d4f', text: '#cf1322' };
  const config = {
    '收檢': { bg: '#fff7e6', border: '#ffa940', text: '#d46b08' },
    '耗材': { bg: '#f6ffed', border: '#73d13d', text: '#389e0d' },
    '其他': { bg: '#f0f5ff', border: '#91d5ff', text: '#1d39c4' }
  };
  return config[cat] || { bg: '#f9f0ff', border: '#d3adf7', text: '#722ed1' };
};

function App() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userName, setUserName] = useState(localStorage.getItem('modernLabUser') || '');
  const [activeTab, setActiveTab] = useState('lobby');
  const [loginForm, setLoginForm] = useState({ name: '', password: '' });
  
  const [form, setForm] = useState({ clinic: '', category: '收檢', priority: false, deadline: '' });
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historySearchDate, setHistorySearchDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ clinic: '', category: '', deadline: '' });

  // --- 1. 新增：主動檢查 Service Worker 更新邏輯 ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // 主動檢查伺服器是否有新版本
        registration.update();

        // 監聽更新發現事件
        registration.onupdatefound = () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.onstatechange = () => {
              // 當新版下載完成且正在等待生效時
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                if (window.confirm("發現新版本（修正通知問題），是否立即更新？")) {
                  window.location.reload();
                }
              }
            };
          }
        };
      });
    }
  }, []);

  const setupNotifications = async (name) => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, { 
          vapidKey: 'BEQDpcx_iPGyzx-0-e_vctw5TqCseajRjCHCE9XeRi4TIfXEk5ndC-XwRyJFYuSmrTxej_zweULO6ib3DGbYCeE' 
        });
        
        if (token) {
          console.log("裝置 Token:", token);
          const q = query(collection(db, "users"), where("name", "==", name));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const userDocId = snap.docs[0].id;
            await updateDoc(doc(db, "users", userDocId), { fcmToken: token });
          }
        }
      }
    } catch (error) {
      console.error("推播設定錯誤:", error);
    }
  };

  useEffect(() => {
    if (userName) {
      setupNotifications(userName);
    }

    const unsubMessage = onMessage(messaging, (payload) => {
      alert(`${payload.notification.title}\n${payload.notification.body}`);
    });

    const qTasks = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    const unsubTasks = onSnapshot(qTasks, (s) => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const qCats = query(collection(db, "categories"), orderBy("name", "asc"));
    const unsubCats = onSnapshot(qCats, (s) => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    return () => { unsubTasks(); unsubCats(); unsubMessage(); };
  }, [userName]);

  // 更新後的發布邏輯：僅負責存入 Firestore
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!form.clinic) return;

    try {
      await addDoc(collection(db, "tasks"), {
        ...form,
        status: 0, 
        creator: userName, 
        createdAt: serverTimestamp(), 
        picker: '', 
        history: []
      });
      setForm({ clinic: '', category: '收檢', priority: false, deadline: '' });
    } catch (err) {
      console.error("發布失敗", err);
    }
  };

  const loginSuccess = (name) => {
    setUserName(name);
    localStorage.setItem('modernLabUser', name);
    setupNotifications(name);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const { name, password } = loginForm;
    if (!name || !password) return alert("請輸入姓名與密碼");
    const q = query(collection(db, "users"), where("name", "==", name));
    const snap = await getDocs(q);
    if (snap.empty) {
      if (window.confirm(`建立新帳號「${name}」？`)) {
        await addDoc(collection(db, "users"), { name, password });
        loginSuccess(name);
      }
    } else {
      const user = snap.docs[0].data();
      user.password === password ? loginSuccess(name) : alert("密碼錯誤");
    }
  };

  const updateStatus = async (task, newStatus) => {
    const data = { status: newStatus };
    const nowStr = new Date().toLocaleString('zh-TW', { hour12: false });
    if (newStatus === 1) { 
      data.picker = userName; 
      data.claimedAt = serverTimestamp(); 
    }
    else if (newStatus === 2) { 
      data.completedAt = serverTimestamp(); 
    }
    else if (newStatus === 0) {
      if (!window.confirm("確定退回？")) return;
      data.picker = ''; 
      data.claimedAt = null;
      data.history = [...(task.history || []), `⚠️ ${userName} 於 ${nowStr} 退回` ];
    }
    await updateDoc(doc(db, "tasks", task.id), data);
  };

  const saveEdit = async (task) => {
    const nowStr = new Date().toLocaleString('zh-TW', { hour12: false });
    const log = `✏️ ${userName} 於 ${nowStr} 修改內容`;
    await updateDoc(doc(db, "tasks", task.id), {
      ...editForm,
      history: [...(task.history || []), log]
    });
    setEditingId(null);
  };

  const handleDeleteTask = async (task) => {
    if (!window.confirm("確定刪除此任務？刪除後將移至歷史記錄。")) return;
    const nowStr = new Date().toLocaleString('zh-TW', { hour12: false });
    const log = `🗑️ ${userName} 於 ${nowStr} 刪除任務`;
    await updateDoc(doc(db, "tasks", task.id), {
      status: 3,
      history: [...(task.history || []), log]
    });
  };

  const formatTime = (ts) => {
    if (!ts) return '...';
    return ts.toDate().toLocaleString('zh-TW', { 
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false 
    });
  };

  const getSortedTasks = (taskList) => {
    const weights = { '收檢': 1, '耗材': 2, '其他': 3 };
    return [...taskList].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority ? -1 : 1;
      const wa = weights[a.category] || 99, wb = weights[b.category] || 99;
      if (wa !== wb) return wa - wb;
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
  };

  const filteredHistory = tasks.filter(t => {
    if (t.status !== 2 && t.status !== 3) return false; 
    const matchesKeyword = 
      t.clinic?.toLowerCase().includes(historySearchTerm.toLowerCase()) || 
      t.creator?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      t.picker?.toLowerCase().includes(historySearchTerm.toLowerCase());
    const compareDate = t.completedAt || t.createdAt;
    const matchesDate = historySearchDate ? 
      compareDate?.toDate().toISOString().split('T')[0] === historySearchDate : true;
    return matchesKeyword && matchesDate;
  });

  const lobbyCount = tasks.filter(t => t.status === 0).length;
  const myTasksCount = tasks.filter(t => t.status === 1 && t.picker === userName).length;

  if (!userName) return (
    <div style={styles.mobileWrapper}>
      <div style={styles.loginCard}>
        <h2 style={{color:'#003366', marginBottom:'20px'}}>現代醫事系統</h2>
        <form onSubmit={handleAuth} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
          <input style={styles.inputLarge} value={loginForm.name} onChange={e => setLoginForm({...loginForm, name: e.target.value})} placeholder="姓名" />
          <input type="password" style={styles.inputLarge} value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} placeholder="密碼" />
          <button style={styles.blueBtnLarge}>登入系統</button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={styles.mobileWrapper}>
      <header style={styles.header}>
        <span style={{fontSize:'20px', fontWeight:'bold'}}>👤 {userName}</span>
        <button onClick={() => {localStorage.clear(); window.location.reload();}} style={styles.logoutBtn}>登出</button>
      </header>

      <nav style={styles.tabNav}>
        <button onClick={() => setActiveTab('lobby')} style={activeTab === 'lobby' ? styles.activeTab : styles.tab}>
          大廳 {lobbyCount > 0 && <span style={styles.badge}>{lobbyCount}</span>}
        </button>
        <button onClick={() => setActiveTab('myTasks')} style={activeTab === 'myTasks' ? styles.activeTab : styles.tab}>
          我的 {myTasksCount > 0 && <span style={styles.badgeMy}>{myTasksCount}</span>}
        </button>
        <button onClick={() => setActiveTab('history')} style={activeTab === 'history' ? styles.activeTab : styles.tab}>歷史搜尋</button>
      </nav>

      {activeTab === 'lobby' && (
        <section>
          <div style={styles.formBox}>
            <textarea value={form.clinic} onChange={e => setForm({...form, clinic: e.target.value})} placeholder="請輸入任務內容（可換行分段）" style={styles.textarea} />
            <div style={styles.row}>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={styles.select}>
                <option value="收檢">收檢</option><option value="耗材">耗材</option><option value="其他">其他</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <label style={{color:'red', display:'flex', alignItems:'center', gap:'5px'}}>
                <input type="checkbox" checked={form.priority} onChange={e => setForm({...form, priority: e.target.checked})} /> 緊急
              </label>
            </div>
            <div style={styles.row}>
              <span style={{fontSize:'14px', color:'#666'}}>限時：</span>
              <input type="time" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} style={styles.timeInput} />
              <button onClick={handleAddTask} style={styles.blueBtnSmall}>發布任務</button>
            </div>
          </div>
          {getSortedTasks(tasks.filter(t => t.status < 2)).map(t => (
            <TaskCard key={t.id} task={t} userName={userName} onClaim={() => updateStatus(t, 1)} onCancel={() => updateStatus(t, 0)} onComplete={() => updateStatus(t, 2)} onDelete={() => handleDeleteTask(t)} onEdit={() => {setEditingId(t.id); setEditForm({clinic: t.clinic, category: t.category, deadline: t.deadline || ''});}} isEditing={editingId === t.id} editForm={editForm} setEditForm={setEditForm} saveEdit={() => saveEdit(t)} cancelEdit={() => setEditingId(null)} formatTime={formatTime} cats={categories} />
          ))}
        </section>
      )}

      {activeTab === 'myTasks' && getSortedTasks(tasks.filter(t => t.status === 1 && t.picker === userName)).map(t => (
        <TaskCard key={t.id} task={t} userName={userName} onCancel={() => updateStatus(t, 0)} onComplete={() => updateStatus(t, 2)} formatTime={formatTime} />
      ))}
      
      {activeTab === 'history' && (
        <section>
          <div style={styles.searchContainer}>
            <input type="text" placeholder="🔍 搜尋任務、診所、人員..." value={historySearchTerm} onChange={e => setHistorySearchTerm(e.target.value)} style={styles.searchInput} />
            <div style={{display:'flex', alignItems:'center', gap:'10px', marginTop:'8px'}}>
              <span style={{fontSize:'12px', color:'#666'}}>日期篩選:</span>
              <input type="date" value={historySearchDate} onChange={e => setHistorySearchDate(e.target.value)} style={styles.dateInputSmall} />
              <button onClick={() => {setHistorySearchTerm(''); setHistorySearchDate('');}} style={styles.clearBtn}>重置</button>
            </div>
          </div>
          {filteredHistory.length > 0 ? filteredHistory.map(t => (
            <TaskCard key={t.id} task={t} userName={userName} formatTime={formatTime} isHistory />
          )) : <div style={{textAlign:'center', padding:'40px', color:'#999'}}>找不到符合條件的歷史任務</div>}
        </section>
      )}
    </div>
  );
}

const TaskCard = ({ task, userName, onClaim, onCancel, onComplete, onDelete, onEdit, isEditing, editForm, setEditForm, saveEdit, cancelEdit, formatTime, isHistory, cats }) => {
  const isDeleted = task.status === 3;
  const colors = getTaskCardColors(isEditing ? editForm.category : task.category, task.priority, isDeleted);
  
  return (
    <div style={{...styles.card, backgroundColor: colors.bg, border: `1px solid ${colors.border}`, borderLeft: `8px solid ${colors.border}`}}>
      <div style={{flex: 1, minWidth: 0}}>
        {isEditing ? (
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            <textarea style={styles.textareaSmall} value={editForm.clinic} onChange={e => setEditForm({...editForm, clinic: e.target.value})} />
            <div style={{display:'flex', gap:'5px'}}>
              <select style={styles.selectSmall} value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                <option value="收檢">收檢</option><option value="耗材">耗材</option><option value="其他">其他</option>
                {cats?.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <button onClick={saveEdit} style={styles.saveBtn}>存檔</button>
              <button onClick={cancelEdit} style={styles.cancelBtn}>✕</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{fontSize:'18px', fontWeight:'bold', color: colors.text, marginBottom:'8px', whiteSpace:'pre-wrap', wordBreak:'break-word', textDecoration: isDeleted ? 'line-through' : 'none'}}>
              {isDeleted && "【已刪除】"} {task.priority && "🚨 "}[{task.category}] {task.clinic}
            </div>
            <div style={styles.details}>
              {task.deadline && <span style={{color:'#d4380d', fontWeight:'bold'}}>⏰ 限時: {task.deadline} | </span>}
              <div>📝 發布: {task.creator} | {formatTime(task.createdAt)}</div>
              {task.picker && <div style={{color:'#0056b3', fontWeight:'bold'}}>跑單: {task.picker} | {formatTime(task.claimedAt)}</div>}
              {task.status === 2 && <div style={{color:'green', fontWeight:'bold'}}>✅ 完成: {formatTime(task.completedAt)}</div>}
              {task.history && task.history.length > 0 && (
                <div style={{marginTop:'5px', color:'#666', fontStyle:'italic', fontSize:'12px', borderTop:'1px dashed #ccc', paddingTop:'3px'}}>
                  {task.history[task.history.length - 1]}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div style={styles.actionArea}>
        {!isHistory && !isEditing && (
          <>
            {task.status === 0 && <button onClick={onClaim} style={styles.claimBtn}>接單</button>}
            {task.status === 1 && task.picker === userName && (
              <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                <button onClick={onComplete} style={styles.doneBtn}>完成</button>
                <button onClick={onCancel} style={styles.undoBtn}>退回</button>
              </div>
            )}
            <div style={{marginTop:'5px'}}>
               <button onClick={onEdit} style={styles.iconBtn}>✏️</button>
               {task.creator === userName && <button onClick={onDelete} style={styles.iconBtn}>🗑️</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  mobileWrapper: { maxWidth: '500px', margin: '0 auto', padding: '10px', backgroundColor: '#f5f7f9', minHeight: '100vh', fontFamily: 'sans-serif' },
  loginCard: { marginTop: '100px', padding: '30px', backgroundColor: '#fff', borderRadius: '20px', textAlign:'center', boxShadow:'0 4px 12px rgba(0,0,0,0.1)' },
  inputLarge: { padding: '15px', fontSize: '16px', borderRadius: '10px', border: '1px solid #ddd', width:'100%', boxSizing:'border-box' },
  blueBtnLarge: { padding: '15px', backgroundColor: '#003366', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '18px', fontWeight: 'bold', width:'100%' },
  header: { display: 'flex', justifyContent: 'space-between', padding: '10px 15px', backgroundColor: '#fff', borderRadius: '10px', marginBottom: '10px', alignItems:'center' },
  logoutBtn: { padding: '5px 10px', borderRadius: '5px', border: '1px solid #ccc', background: '#fff', fontSize: '12px' },
  tabNav: { display: 'flex', gap: '5px', marginBottom: '15px' },
  tab: { flex: 1, padding: '12px 5px', border: 'none', background: '#fff', borderRadius: '8px', fontSize: '16px' },
  activeTab: { flex: 1, padding: '12px 5px', border: 'none', background: '#003366', color: '#fff', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold' },
  badge: { background: '#ff4d4f', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '12px', marginLeft: '3px' },
  badgeMy: { background: '#1890ff', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '12px', marginLeft: '3px' },
  formBox: { backgroundColor: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '15px', boxShadow:'0 2px 4px rgba(0,0,0,0.05)' },
  textarea: { width:'100%', padding: '10px', fontSize: '16px', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px', boxSizing:'border-box' },
  textareaSmall: { width:'100%', padding: '5px', fontSize: '14px', borderRadius: '5px', border: '1px solid #ccc' },
  row: { display: 'flex', gap: '10px', alignItems:'center', marginTop: '10px' },
  select: { padding: '8px', fontSize: '14px', borderRadius: '5px', flex:1 },
  selectSmall: { padding: '5px', fontSize: '12px', borderRadius: '5px', flex:1 },
  timeInput: { padding: '8px', fontSize: '14px', borderRadius: '5px', border: '1px solid #ddd' },
  blueBtnSmall: { padding: '8px 20px', backgroundColor: '#003366', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold' },
  searchContainer: { background: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  searchInput: { width: '100%', padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' },
  dateInputSmall: { padding: '5px', fontSize: '12px', borderRadius: '5px', border: '1px solid #ccc' },
  clearBtn: { padding: '5px 10px', backgroundColor: '#eee', border: 'none', borderRadius: '5px', fontSize: '12px' },
  card: { padding: '12px', borderRadius: '10px', marginBottom: '10px', display: 'flex', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
  details: { fontSize: '13px', color: '#666', lineHeight: '1.6' },
  actionArea: { marginLeft: '10px', textAlign: 'center' },
  claimBtn: { padding: '10px 15px', backgroundColor: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' },
  doneBtn: { padding: '8px 15px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' },
  undoBtn: { padding: '5px 10px', backgroundColor: '#888', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '12px' },
  saveBtn: { padding: '5px 10px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '5px' },
  cancelBtn: { padding: '5px 10px', backgroundColor: '#eee', border: 'none', borderRadius: '5px' },
  iconBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '0 5px' }
};

export default App;