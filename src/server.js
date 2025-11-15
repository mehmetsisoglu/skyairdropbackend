// src/server.js
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 10000;

// ====================== MIDDLEWARE ======================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ====================== POSTGRESQL ======================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// ====================== DB INIT ======================
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

      INSERT INTO airdrop_stats (id, participants, remaining)
      VALUES (1, 0, 5000)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Veritabanı tabloları başarıyla kontrol edildi/oluşturuldu.');
  } catch (err) {
    console.error('DB Başlatma Hatası:', err.message);
  } finally {
    client.release();
  }
}

// ====================== ROUTES ======================

// 1. X (Twitter) Doğrulama
app.post('/verify-x', async (req, res) => {
  console.log('POST /verify-x →', req.body);

  const { username, wallet } = req.body;

  if (!username || !wallet) {
    return res.status(400).json({ message: 'Username ve wallet gerekli' });
  }

  const cleanUsername = username.startsWith('@') ? username.slice(1) : username.trim();
  if (cleanUsername.length < 1 || cleanUsername.length > 15 || !/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return res.status(400).json({ message: 'Geçersiz X kullanıcı adı' });
  }

  // Gerçek X API kontrolü istersen buraya eklenir
  // Şimdilik sadece format kontrolü + geç

  res.json({ success: true });
});

// 2. Görevleri Kaydet
app.post('/save-tasks', async (req, res) => {
  const { wallet, tasks } = req.body;
  console.log('/save-tasks →', { wallet, tasks });

  if (!wallet || !Array.isArray(tasks)) {
    return res.status(400).json({ message: 'Geçersiz veri' });
  }

  try {
    await pool.query(
      `INSERT INTO airdrop_tasks (wallet, tasks) 
       VALUES ($1, $2) 
       ON CONFLICT (wallet) DO UPDATE SET tasks = $2`,
      [wallet.toLowerCase(), tasks]
    );

    // Katılımcı sayısını artır
    await pool.query(`
      UPDATE airdrop_stats 
      SET participants = participants + 1, 
          remaining = GREATEST(remaining - 1, 0) 
      WHERE id = 1
    `);

    res.json({ success: true });
  } catch (err) {
    console.error('DB Kaydetme Hatası:', err.message);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// 3. Kullanıcının Görevlerini Getir
app.get('/get-tasks', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.json({ tasks: [] });

  try {
    const result = await pool.query(
      'SELECT tasks FROM airdrop_tasks WHERE wallet = $1',
      [wallet.toLowerCase()]
    );
    res.json({ tasks: result.rows[0]?.tasks || [] });
  } catch (err) {
    console.error('DB Okuma Hatası:', err.message);
    res.json({ tasks: [] });
  }
});

// 4. Airdrop İstatistikleri
app.get('/airdrop-stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT participants, remaining FROM airdrop_stats WHERE id = 1');
    const stats = result.rows[0] || { participants: 0, remaining: 5000 };
    res.json(stats);
  } catch (err) {
    console.error('Stats Hatası:', err.message);
    res.json({ participants: 0, remaining: 5000 });
  }
});

// 5. Claim Bildirimi
app.post('/notify-claim', async (req, res) => {
  const { wallet } = req.body;
  console.log('CLAIM BİLDİRİMİ:', wallet);

  // Telegram botuna gönder (isteğe bağlı)
  // await sendToTelegram(`Yeni Claim: ${wallet}`);

  res.json({ success: true });
});

// ====================== HEALTH CHECK ======================
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'SKYL Airdrop Backend Active', time: new Date().toISOString() });
});

// ====================== SUNUCU BAŞLAT ======================
app.listen(PORT, async () => {
  await initDB();
  console.log(`SKYL backend (PostgreSQL) running on ${PORT}`);
  console.log(`http://localhost:${PORT}`);
});

// Hata yakalama
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
