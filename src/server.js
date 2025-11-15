// src/server.js
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// DB Init
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS airdrop_tasks (
        wallet TEXT PRIMARY KEY,
        tasks TEXT[] DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS airdrop_stats (
        id SERIAL PRIMARY KEY,
        participants INT DEFAULT 0,
        remaining INT DEFAULT 5000
      );
      INSERT INTO airdrop_stats (id, participants, remaining) VALUES (1, 0, 5000)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Veritabanı tabloları başarıyla kontrol edildi/oluşturuldu.');
  } catch (err) {
    console.error('DB Hatası:', err.message);
  } finally {
    client.release();
  }
}

// ROUTES
app.post('/verify-x', async (req, res) => {
  console.log('X Doğrulama:', req.body);
  const { username, wallet } = req.body;
  if (!username || !wallet) return res.status(400).json({ message: 'Eksik veri' });

  const clean = username.startsWith('@') ? username.slice(1) : username;
  if (clean.length < 1 || clean.length > 15) {
    return res.status(400).json({ message: 'Geçersiz X kullanıcı adı' });
  }

  res.json({ success: true });
});

app.post('/save-tasks', async (req, res) => {
  const { wallet, tasks } = req.body;
  if (!wallet || !Array.isArray(tasks)) return res.status(400).json({ message: 'Geçersiz veri' });

  try {
    await pool.query(
      `INSERT INTO airdrop_tasks (wallet, tasks) VALUES ($1, $2)
       ON CONFLICT (wallet) DO UPDATE SET tasks = $2`,
      [wallet.toLowerCase(), tasks]
    );
    await pool.query(`
      UPDATE airdrop_stats SET participants = participants + 1,
      remaining = GREATEST(remaining - 1, 0) WHERE id = 1
    `);
    res.json({ success: true });
  } catch (err) {
    console.error('Kaydetme hatası:', err);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

app.get('/get-tasks', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.json({ tasks: [] });
  try {
    const result = await pool.query('SELECT tasks FROM airdrop_tasks WHERE wallet = $1', [wallet.toLowerCase()]);
    res.json({ tasks: result.rows[0]?.tasks || [] });
  } catch {
    res.json({ tasks: [] });
  }
});

app.get('/airdrop-stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT participants, remaining FROM airdrop_stats WHERE id = 1');
    res.json(result.rows[0] || { participants: 0, remaining: 5000 });
  } catch {
    res.json({ participants: 0, remaining: 5000 });
  }
});

app.post('/notify-claim', (req, res) => {
  console.log('CLAIM:', req.body.wallet);
  res.json({ success: true });
});

// Start
app.listen(PORT, async () => {
  await initDB();
  console.log(`SKYL backend running on ${PORT}`);
});
