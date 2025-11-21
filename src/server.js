// src/server.js (v6.3 – FINAL CRASH FIX: Whale Watcher Disabled)
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import helmet from 'helmet';
import { WebSocketServer } from 'ws'; 

import { pool, initDB } from './db.js'; 
import { startSkylineSystem } from './buy-bot.js';
import { startSentimentLoop } from './cron/sentimentJob.js';
import { startWhaleWatcher } from './services/whaleWatcher.js'; 
import sentimentRoutes from './routes/sentimentRoutes.js';
import whaleRoutes from './routes/whaleRoutes.js'; 
import bot, { startTelegramBot } from './bot.js';

const app = express();
const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ====================== WSS SUNUCUSU TANIMLAMA ======================
const wss = new WebSocketServer({ noServer: true }); 

// ====================== MIDDLEWARE ======================
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '10mb' }));

app.use(helmet({
    frameguard: { action: 'deny' }, 
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"], 
            scriptSrc: ["'self'", "'unsafe-inline'"], 
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"], 
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https://skyairdropbackend-1.onrender.com", "wss:"], 
        }
    }
}));
app.use(express.urlencoded({ extended: true }));

// ====================== TELEGRAM WEBHOOK ROUTE ======================
app.post(`/bot${TOKEN}`, (req, res) => {
  if (bot) { bot.processUpdate(req.body); }
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
    await pool.query(`UPDATE airdrop_stats SET participants = participants + 1 WHERE id = 1`);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: 'DB Hatası' }); }
});

app.get('/get-tasks', async (req, res) => {
  try {
    const r = await pool.query('SELECT tasks FROM airdrop_tasks WHERE wallet = $1', [req.query.wallet]);
    res.json({ tasks: r.rows[0]?.tasks || [] });
  } catch (e) { res.json({ tasks: [] }); }
});

app.get('/airdrop-stats', (req, res) => res.json({ participants: 1250, remaining: 3750 }));
app.get('/', (req, res) => res.json({ status: 'OK', mode: process.env.RENDER_EXTERNAL_URL ? 'Webhook' : 'Polling' }));

// ====================== BAŞLATMA (KRİTİK DÜZELTME) ======================
const server = app.listen(PORT, async () => {
  await initDB(); 
  console.log(`SKYL backend running on ${PORT}`);
  
  await startTelegramBot(); 
  
  console.log("🚀 Skyline Logic Sistemleri...");
  startSkylineSystem();      // BuyBot
  startSentimentLoop();      // AI Haberler
  // startWhaleWatcher(wss);  <-- ALCHEMY KISITLAMASI NEDENİYLE DEVRE DIŞI BIRAKILDI
});

// WSS BAĞLANTISINI HTTP SERVER'A BAĞLAMA (Whale Watcher kapalı olsa bile WSS sunucusu açıktır)
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/whales/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
      console.log('🔗 Yeni WebSocket bağlantısı kuruldu.');
    });
  } else {
    socket.destroy();
  }
});

// Kapatma
process.on('SIGTERM', () => {
  server.close(() => { pool.end(); process.exit(0); });
});
