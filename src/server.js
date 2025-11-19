// src/server.js (v4.0 – WEBHOOK ROUTE ADDED)
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { pool, initDB } from './db.js'; 
import { startSkylineSystem } from './buy-bot.js';
import { startSentimentLoop } from './cron/sentimentJob.js';
import { startWhaleWatcher } from './services/whaleWatcher.js';
import sentimentRoutes from './routes/sentimentRoutes.js';
import whaleRoutes from './routes/whaleRoutes.js';

// ==> YENİ: Bot instance'ını import et
import bot, { startTelegramBot } from './bot.js';

const app = express();
const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ====================== MIDDLEWARE ======================
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ====================== TELEGRAM WEBHOOK ROUTE (ÇÖZÜM) ======================
// Telegram mesajları buraya POST eder, biz de bota iletiriz
app.post(`/bot${TOKEN}`, (req, res) => {
  if (bot) {
    bot.processUpdate(req.body);
  }
  res.sendStatus(200);
});

// ====================== API ROUTES ======================
app.use('/api', sentimentRoutes);
app.use('/api', whaleRoutes);

// Diğer Endpointler
app.post('/verify-x', (req, res) => res.json({ success: true }));
app.post('/save-tasks', async (req, res) => {
  try {
    await pool.query(`INSERT INTO airdrop_tasks (wallet, tasks) VALUES ($1, $2) ON CONFLICT (wallet) DO NOTHING`, [req.body.wallet, req.body.tasks]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/get-tasks', async (req, res) => {
  const r = await pool.query('SELECT tasks FROM airdrop_tasks WHERE wallet = $1', [req.query.wallet]);
  res.json({ tasks: r.rows[0]?.tasks || [] });
});
app.get('/airdrop-stats', (req, res) => res.json({ participants: 1250, remaining: 3750 }));
app.get('/', (req, res) => res.json({ status: 'OK', mode: process.env.RENDER_EXTERNAL_URL ? 'Webhook' : 'Polling' }));

// ====================== BAŞLATMA ======================
const server = app.listen(PORT, async () => {
  await initDB();
  console.log(`SKYL backend running on ${PORT}`);
  
  // Bot Başlatma (Webhook veya Polling kararını kendi verir)
  await startTelegramBot();

  console.log("🚀 Skyline Logic Sistemleri...");
  startSkylineSystem();      
  startSentimentLoop();      
  startWhaleWatcher();       
});

process.on('SIGTERM', () => {
  server.close(() => { pool.end(); process.exit(0); });
});
