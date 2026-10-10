const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 模擬資料庫（在 Serverless 中，每次請求可能會重置，但非常適合用來測試漏洞）
const users = {
  1: { id: 1, username: 'alice', role: 'user', secret: "Alice的機密：flag{alice_vercel_123}" },
  2: { id: 2, username: 'bob', role: 'user', secret: "Bob的秘密：暗戀隔壁班" },
  3: { id: 3, username: 'admin', role: 'admin', secret: "FLAG{vercel_serverless_admin_999}" }
};

// 登入 API (SQLi 模擬或邏輯繞過)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // 簡易模擬
  if (username === "admin" || username.includes("'")) {
    res.json({ success: true, message: "登入成功！", user: users[3] });
  } else if (users[1].username === username) {
    res.json({ success: true, message: "登入成功！", user: users[1] });
  } else {
    res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
  }
});

// IDOR 漏洞 API
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  if (users[userId]) {
    res.json(users[userId]);
  } else {
    res.status(404).json({ error: "找不到用戶" });
  }
});

module.exports = app;
