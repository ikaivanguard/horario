import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";

const db = new Database("ikai.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    code TEXT
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    category TEXT,
    description TEXT,
    status TEXT DEFAULT 'Pendiente',
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day INTEGER,
    hour INTEGER,
    user_id INTEGER,
    UNIQUE(day, hour, user_id)
  );
`);

// Insert dummy user if not exists
try {
  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (username, code) VALUES (?, ?)"
  );
  insertUser.run("admin", "1234");
} catch (e) {
  console.error("Error inserting dummy user", e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/login", (req, res) => {
    const { username, code } = req.body;
    const user = db
      .prepare("SELECT * FROM users WHERE username = ? AND code = ?")
      .get(username, code);
    if (user) {
      res.json({ success: true, user });
    } else {
      // Auto-register for prototype purposes if code is provided
      if (username && code) {
        try {
          const info = db
            .prepare("INSERT INTO users (username, code) VALUES (?, ?)")
            .run(username, code);
          const newUser = db
            .prepare("SELECT * FROM users WHERE id = ?")
            .get(info.lastInsertRowid);
          res.json({ success: true, user: newUser });
        } catch (e) {
          res
            .status(400)
            .json({ success: false, message: "Username already exists" });
        }
      } else {
        res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }
    }
  });

  app.get("/api/feedback", (req, res) => {
    const feedbacks = db
      .prepare(
        `
      SELECT f.*, u.username 
      FROM feedback f 
      LEFT JOIN users u ON f.user_id = u.id 
      ORDER BY f.created_at DESC
    `
      )
      .all();
    res.json(feedbacks);
  });

  app.post("/api/feedback", (req, res) => {
    const { title, category, description, user_id } = req.body;
    const info = db
      .prepare(
        "INSERT INTO feedback (title, category, description, user_id) VALUES (?, ?, ?, ?)"
      )
      .run(title, category, description, user_id);
    res.json({ success: true, id: info.lastInsertRowid });
  });

  app.put("/api/feedback/:id/status", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE feedback SET status = ? WHERE id = ?").run(
      status,
      req.params.id
    );
    res.json({ success: true });
  });

  app.get("/api/schedule", (req, res) => {
    const schedule = db
      .prepare(
        `
      SELECT s.*, u.username 
      FROM schedule s 
      JOIN users u ON s.user_id = u.id
    `
      )
      .all();
    res.json(schedule);
  });

  app.post("/api/schedule", (req, res) => {
    const { day, hour, user_id } = req.body;

    // Check count
    const count = db
      .prepare("SELECT COUNT(*) as count FROM schedule WHERE day = ? AND hour = ?")
      .get(day, hour) as { count: number };

    if (count.count >= 4) {
      return res
        .status(400)
        .json({ success: false, message: "Block is full (max 4)" });
    }

    try {
      db.prepare(
        "INSERT INTO schedule (day, hour, user_id) VALUES (?, ?, ?)"
      ).run(day, hour, user_id);
      res.json({ success: true });
    } catch (e) {
      res
        .status(400)
        .json({ success: false, message: "Already assigned or error" });
    }
  });

  app.delete("/api/schedule", (req, res) => {
    const { day, hour, user_id } = req.body;
    db.prepare(
      "DELETE FROM schedule WHERE day = ? AND hour = ? AND user_id = ?"
    ).run(day, hour, user_id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
