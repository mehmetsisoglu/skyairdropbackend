// src/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ====================== MIDDLEWARE ======================
app.use(cors()); // Frontend'ten erişim için
app.use(express.json({ limit: '10mb' })); // JSON body parse (KRİTİK!)
app.use(express.urlencoded({ extended: true }));

// ====================== POSTGRESQL POOL ======================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ====================== DB INIT ======================
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Airdrop görevleri (wallet → tamamlanan görevler)
      CREATE TABLE IF NOT EXISTS airdrop_tasks (
        wallet TEXT PRIMARY KEY,
        tasks TEXT[] DEFAULT '{}'
      );

      -- Airdrop istatistikleri
      CREATE TABLE IF NOT EXISTS airdrop_stats (
        id SERIAL PRIMARY KEY,
        participants INT DEFAULT 0,
        remaining INT DEFAULT 5000
      );

      -- İlk satır yoksa ekle
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
  console.log('POST /verify-x çağrıldı:', req.body); // LOG

  const { username, wallet } = req.body;

  if (!username || !wallet) {
    return res.status(400).json({ message: 'Username ve wallet gerekli' });
  }

  // @ işareti yoksa ekle (X API için)
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

  // Şimdilik sadece kullanıcı adı kontrolü (X API entegrasyonu eklenebilir)
  // Gerçek kontrol istersen aşağıya X API kodu eklenebilir
  if (cleanUsername.length < 1 || cleanUsername.length > 15) {
    return res.status(400).json({ message: 'Geçersiz X kullanıcı username' });
  }

  console.log(`X doğrulama BAŞARILI: @${cleanUsername}`);
  res.json({ success: true });
});

// 2. Görevleri Kaydet
app.post('/save-tasks', async (req, res) => {
  const { wallet, tasks } = req.body;
  console.log('/save-tasks:', { wallet, tasks });

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
    console.error('DB Kaydetme Hatası:', err);
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
    console.error('DB Okuma Hatası:', err);
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
    console.error('Stats Hatası:', err);
    res.json({ participants: 0, remaining: 5000 });
  }
});

// 5. Claim Bildirimi (Telegram Botuna Gönder)
app.post('/notify-claim', async (req, res) => {
  const { wallet } = req.body;
  console.log('CLAIM BİLDİRİMİ:', wallet);

  // Buraya Telegram botu entegrasyonu eklenebilir
  // Örnek: axios.post(TELEGRAM_URL, { text: `Claim: ${wallet}` })

  res.json({ success: true });
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
