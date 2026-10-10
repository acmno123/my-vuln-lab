const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 建立 SQLite 資料庫
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE users (id INT, username TEXT, password TEXT, role TEXT, secret TEXT)");
  db.run("INSERT INTO users VALUES (1, 'alice', 'pass123', 'user', 'Alice的日記：今天天氣很好。')");
  db.run("INSERT INTO users VALUES (2, 'bob', 'pass456', 'user', 'Bob的秘密：我暗恋隔壁班的小美。')");
  db.run("INSERT INTO users VALUES (3, 'admin', 'adminpassword', 'admin', 'FLAG{real_web_admin_flag_777}')");

  // 留言板表（用來測試 XSS）
  db.run("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, content TEXT)");
  db.run("INSERT INTO posts (username, content) VALUES ('admin', '歡迎來到本網站！大家請遵守秩序。')");
});

// 1. 登入 API（存在 SQL 注入漏洞）
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // 【故意埋入 SQL 注入】直接用字串串接
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  
  db.get(query, [], (err, row) => {
    if (err) {
      res.status(500).json({ success: false, message: "資料庫錯誤" });
    } else if (row) {
      res.json({ success: true, message: "登入成功！", user: { id: row.id, username: row.username, role: row.role } });
    } else {
      res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
    }
  });
});

// 2. 個人資料 API（存在 IDOR 越權訪問漏洞）
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  // 【故意埋入 IDOR】沒有檢查當前登入者是否有權限看這個 id 的資料
  db.get(`SELECT id, username, role, secret FROM users WHERE id = ?`, [userId], (err, row) => {
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: "找不到用戶" });
    }
  });
});

// 3. 取得留言板列表
app.get('/api/posts', (req, res) => {
  db.all(`SELECT * FROM posts`, [], (err, rows) => {
    res.json(rows);
  });
});

// 4. 新增留言 API（存在 Stored XSS 漏洞：沒有對內容做 HTML 跳脫與過濾）
app.post('/api/posts', (req, res) => {
  const { username, content } = req.body;
  // 【故意埋入 XSS】直接將使用者輸入存入資料庫，並在前端渲染
  db.run(`INSERT INTO posts (username, content) VALUES (?, ?)`, [username || '訪客', content], function(err) {
    if (err) {
      res.status(500).json({ success: false });
    } else {
      res.json({ success: true, id: this.lastID });
    }
  });
});

app.listen(3000, () => {
  console.log("真實靶場網站已啟動！請打開瀏覽器訪問 http://localhost:3000");
});