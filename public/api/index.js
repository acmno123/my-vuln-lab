const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 記憶體中的模擬資料庫
const users = {
  1: { id: 1, username: 'alice', password: 'pass123', role: 'user', secret: "Alice的日記：今天天氣很好。" },
  2: { id: 2, username: 'bob', password: 'pass456', role: 'user', secret: "Bob的秘密：暗戀隔壁班的小美。" },
  3: { id: 3, username: 'admin', password: 'adminpassword', role: 'admin', secret: "FLAG{vercel_serverless_admin_999}" }
};

const posts = [
  { id: 1, username: 'admin', content: '歡迎來到本雲端靶場！大家請遵守秩序。' }
];

// 1. 登入 API (模擬 SQL 注入邏輯漏洞)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // 模擬 SQLi 攻擊：若輸入包含單引號或萬用字元，直接讓 admin 登入成功
  if (username && (username.includes("'") || username === "admin")) {
    return res.json({ success: true, message: "登入成功！", user: users[3] });
  }

  // 一般登入檢查
  let foundUser = null;
  for (let id in users) {
    if (users[id].username === username && users[id].password === password) {
      foundUser = users[id];
      break;
    }
  }

  if (foundUser) {
    res.json({ success: true, message: "登入成功！", user: foundUser });
  } else {
    res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
  }
});

// 2. IDOR 漏洞 API：查詢個人資料
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  if (users[userId]) {
    res.json(users[userId]);
  } else {
    res.status(404).json({ error: "找不到用戶" });
  }
});

// 3. 取得留言板
app.get('/api/posts', (req, res) => {
  res.json(posts);
});

// 4. 新增留言 (Stored XSS 測試)
app.post('/api/posts', (req, res) => {
  const { username, content } = req.body;
  posts.push({
    id: posts.length + 1,
    username: username || '訪客',
    content: content || ''
  });
  res.json({ success: true });
});

module.exports = app;
