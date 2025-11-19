// src/server.js (v3.4 – Auto-DB + Whale Watcher)
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
// Veritabanı ve Sistemler
import { pool, initDB } from './db.js'; 
import { startSkylineSystem } from './buy-bot.js';
import { startSentimentLoop } from './cron/sentimentJob.js';
import { startWhaleWatcher } from './services/whaleWatcher.js'; // <== YENİ

// Rotalar
import sentimentRoutes from './routes/sentimentRoutes.js';
import whaleRoutes from './routes/whaleRoutes.js'; // <== YENİ

const app = express();
const PORT = process.env.PORT || 10000;

// ====================== MIDDLEWARE ======================
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ====================== ROUTES ======================

// API Endpoints
app.use('/api', sentimentRoutes);
app.use('/api', whaleRoutes); // <== YENİ: Balina API

// Diğer Bot Rotaları
app.post('/verify-x', async (req, res) => {
  const { username, wallet } = req.body;
  if (!username || !wallet) return res.status(400).json({ message: 'Eksik veri' });
  res.json({ success: true });
});

app.post('/save-tasks', async (req, res) => {
  const { wallet, tasks } = req.body;
  if (!wallet || !Array.isArray(tasks)) return res.status(400).json({ message: 'Hata' });
  try {
    await pool.query(
      `INSERT INTO airdrop_tasks (wallet, tasks) VALUES ($1, $2) 
       ON CONFLICT (wallet) DO UPDATE SET tasks = $2`,
      [wallet.toLowerCase(), tasks]
    );
    await pool.query(`UPDATE airdrop_stats SET participants = participants + 1 WHERE id = 1`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: 'DB Hatası' }); }
});

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

app.post('/notify-claim', (req, res) => res.json({ success: true }));
app.get('/', (req, res) => res.json({ status: 'OK', message: 'SKYL Backend Active' }));

// ====================== BAŞLATMA ======================
const server = app.listen(PORT, async () => {
  await initDB(); // Temel tablolar
  
  console.log(`SKYL backend running on ${PORT}`);
  
  console.log("🚀 Skyline Logic Sistemleri...");
  startSkylineSystem();      // Bot & BuyBot
  startSentimentLoop();      // AI Haberler
  startWhaleWatcher();       // <== YENİ: Balina Takibi (Tabloyu da kuracak)
});
// Kapatma
process.on('SIGTERM', () => {
  server.close(() => { pool.end(); process.exit(0); });
});
