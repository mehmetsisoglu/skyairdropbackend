// src/server.js (v3.2 – Hyper Logic AI + Sentiment API Entegre)
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
// Veritabanı ve Bot başlatıcıyı dışarıdan alıyoruz
import { pool, initDB } from './db.js'; 
import { startSkylineSystem } from './buy-bot.js';
// Sentiment Analiz Modülleri (Hyper Logic AI)
import { startSentimentLoop } from './cron/sentimentJob.js';
import sentimentRoutes from './routes/sentimentRoutes.js';

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

// ====================== ROUTES ======================

// 1. Sentiment API (React buradan veri çekecek)
app.use('/api', sentimentRoutes);

// 2. X (Twitter) Doğrulama
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

  res.json({ success: true });
});

// 3. Görevleri Kaydet
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

// 4. Kullanıcının Görevlerini Getir
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

// 5. Airdrop İstatistikleri
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

// 6. Claim Bildirimi
app.post('/notify-claim', async (req, res) => {
  const { wallet } = req.body;
  console.log('CLAIM BİLDİRİMİ:', wallet);
  res.json({ success: true });
});

// Health Check
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'SKYL Airdrop Backend Active', time: new Date().toISOString() });
});

// ====================== SUNUCU BAŞLATMA ======================
const server = app.listen(PORT, async () => {
  // Önce Veritabanı Tablolarını Kontrol Et
  await initDB();
  
  console.log(`SKYL backend (PostgreSQL) running on ${PORT}`);
  
  // ==> MEVCUT SİSTEMLERİ BAŞLAT (BuyBot + Telegram)
  console.log("🚀 Skyline Logic Sistemleri Başlatılıyor...");
  startSkylineSystem();

  // ==> YENİ: HYPER LOGIC AI SİSTEMİNİ BAŞLAT (Sentiment Analiz)
  console.log("🧠 Hyper Logic AI Modülü Devreye Alınıyor...");
  startSentimentLoop();
});

// ============================================================
//        GRACEFUL SHUTDOWN
// ============================================================
const gracefulShutdown = (signal) => {
  console.log(`[server.js] ${signal} sinyali alındı. Sistem güvenli kapatılıyor...`);
  
  server.close(() => {
    console.log('[server.js] HTTP sunucusu kapatıldı.');
    
    pool.end(() => {
      console.log('[server.js] Veritabanı bağlantısı kapatıldı.');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('[server.js] Kapanma zaman aşımı. Zorla kapatılıyor.');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});