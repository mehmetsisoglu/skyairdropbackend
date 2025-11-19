// src/server.js (v3.3 – WHALE WATCHER ADDED)
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
// Veritabanı ve Bot başlatıcı
import { pool, initDB } from './db.js'; 
import { startSkylineSystem } from './buy-bot.js';
// Sentiment Analiz Modülleri
import { startSentimentLoop } from './cron/sentimentJob.js';
import sentimentRoutes from './routes/sentimentRoutes.js';
// ==> YENİ EKLENENLER: Balina Takibi
import { startWhaleWatcher } from './services/whaleWatcher.js';
import whaleRoutes from './routes/whaleRoutes.js';

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

// 1. Sentiment API
app.use('/api', sentimentRoutes);

// 2. Whale API (YENİ)
app.use('/api', whaleRoutes);

// 3. X (Twitter) Doğrulama
app.post('/verify-x', async (req, res) => {
  console.log('POST /verify-x →', req.body);
  const { username, wallet } = req.body;
  if (!username || !wallet) return res.status(400).json({ message: 'Eksik veri' });
  res.json({ success: true });
});

// 4. Görevleri Kaydet
app.post('/save-tasks', async (req, res) => {
  const { wallet, tasks } = req.body;
  if (!wallet || !Array.isArray(tasks)) return res.status(400).json({ message: 'Geçersiz veri' });
  try {
    await pool.query(
      `INSERT INTO airdrop_tasks (wallet, tasks) VALUES ($1, $2) 
       ON CONFLICT (wallet) DO UPDATE SET tasks = $2`,
      [wallet.toLowerCase(), tasks]
    );
    await pool.query(`UPDATE airdrop_stats SET participants = participants + 1, remaining = GREATEST(remaining - 1, 0) WHERE id = 1`);
    res.json({ success: true });
  } catch (err) {
    console.error('DB Hatası:', err.message);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// 5. Diğer Rotalar
app.get('/get-tasks', async (req, res) => {
  const { wallet } = req.query;
  if (!wallet) return res.json({ tasks: [] });
  try {
    const result = await pool.query('SELECT tasks FROM airdrop_tasks WHERE wallet = $1', [wallet.toLowerCase()]);
    res.json({ tasks: result.rows[0]?.tasks || [] });
  } catch (err) { res.json({ tasks: [] }); }
});

app.get('/airdrop-stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT participants, remaining FROM airdrop_stats WHERE id = 1');
    res.json(result.rows[0] || { participants: 0, remaining: 5000 });
  } catch (err) { res.json({ participants: 0, remaining: 5000 }); }
});

app.post('/notify-claim', async (req, res) => {
  console.log('CLAIM:', req.body.wallet);
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'SKYL Backend Active', time: new Date().toISOString() });
});

// ====================== SUNUCU BAŞLATMA ======================
const server = app.listen(PORT, async () => {
  await initDB();
  
  console.log(`SKYL backend running on ${PORT}`);
  
  // 1. Bot Sistemleri
  console.log("🚀 Skyline Logic Sistemleri Başlatılıyor...");
  startSkylineSystem();

  // 2. AI Analiz
  console.log("🧠 Hyper Logic AI Devrede...");
  startSentimentLoop();

  // 3. Balina Takibi (YENİ)
  console.log("🌊 On-Chain Balina Takibi Başlatılıyor...");
  startWhaleWatcher();
});

// Graceful Shutdown
const gracefulShutdown = (signal) => {
  console.log(`[server.js] ${signal} alındı, kapatılıyor...`);
  server.close(() => {
    pool.end(() => {
      console.log('DB bağlantısı kapatıldı.');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 5000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
