const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { exec } = require('child_process'); // 【新加入】用來實作指令注入 (RCE)
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 確保上傳資料夾存在
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 建立 SQLite 資料庫
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE users (id INT, username TEXT, password TEXT, role TEXT, secret TEXT)");
  db.run("INSERT INTO users VALUES (1, 'alice', 'pass123', 'user', 'Alice的日記：今天天氣很好。')");
  db.run("INSERT INTO users VALUES (2, 'bob', 'pass456', 'user', 'Bob的秘密：我暗戀隔壁班的小美。')");
  db.run("INSERT INTO users VALUES (3, 'admin', 'adminpassword', 'admin', 'FLAG{ultimate_web_hack_master_999}')");

  // 敏感設定表（專供 SQLi UNION 攻擊挖掘）
  db.run("CREATE TABLE sensitive_flags (id INT, flag_name TEXT, secret_key TEXT)");
  db.run("INSERT INTO sensitive_flags VALUES (1, 'System Root Flag', 'FLAG{sql_union_select_master_888}')");

  // 留言板表
  db.run("CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, content TEXT)");
  db.run("INSERT INTO posts (username, content) VALUES ('admin', '歡迎來到全面升級版危險靶場！')");
});

// 1. 升級版登入 API（支援 SQL 注入與 UNION 攻擊）
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  
  db.get(query, [], (err, row) => {
    if (err) {
      // 故意把詳細 SQL 錯誤吐出來，方便攻擊者透過 Error-based SQLi 偵測
      res.status(500).json({ success: false, error: err.message });
    } else if (row) {
      res.json({ success: true, message: "登入成功！", user: { id: row.id, username: row.username, role: row.role } });
    } else {
      res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
    }
  });
});

// 2. IDOR 越權訪問漏洞
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  db.get(`SELECT id, username, role, secret FROM users WHERE id = ?`, [userId], (err, row) => {
    if (row) {
      res.json(row);
    } else {
      res.status(404).json({ error: "找不到用戶" });
    }
  });
});

// 3. 取得留言板
app.get('/api/posts', (req, res) => {
  db.all(`SELECT * FROM posts`, [], (err, rows) => {
    res.json(rows);
  });
});

// 4. Stored XSS 留言板
app.post('/api/posts', (req, res) => {
  const { username, content } = req.body;
  db.run(`INSERT INTO posts (username, content) VALUES (?, ?)`, [username || '訪客', content], function(err) {
    if (err) {
      res.status(500).json({ success: false });
    } else {
      res.json({ success: true, id: this.lastID });
    }
  });
});

// 5. 【全新加入】命令注入漏洞 (RCE - Remote Code Execution)
// 模擬網站的「伺服器連線測試（Ping）」功能
app.post('/api/ping', (req, res) => {
  const { host } = req.body;
  // 【致命漏洞】直接把使用者輸入拼接進系統終端機指令中！
  // 攻擊者可以輸入: 127.0.0.1 & whoami 或 127.0.0.1 && dir
  const command = `ping -c 1 ${host}`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      return res.json({ success: false, output: stderr || error.message });
    }
    res.json({ success: true, output: stdout });
  });
});

// 6. 【全新加入】不安全的檔案上傳漏洞（可上傳 Web Shell）
app.post('/api/upload', (req, res) => {
  // 簡易模擬接收文字並直接寫入 public/uploads/ 檔案中
  const { filename, code } = req.body;
  if (!filename || !code) {
    return res.status(400).json({ error: "缺少檔名或程式碼" });
  }

  const safePath = path.join(uploadDir, path.basename(filename));
  fs.writeFile(safePath, code, (err) => {
    if (err) {
      return res.status(500).json({ error: "儲存檔案失敗" });
    }
    res.json({ success: true, message: `檔案已成功上傳至 /uploads/${filename}，你可以直接訪問它執行！` });
  });
});

app.listen(3000, () => {
  console.log("🔥 升級版危險靶場已啟動：http://localhost:3000");
});
