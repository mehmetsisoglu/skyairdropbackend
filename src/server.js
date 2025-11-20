// src/server.js (v6.0 - FINAL WEB SOCKET ARCHITECTURE)
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import helmet from 'helmet';
import ws from 'ws'; // Yeni WebSocket Kütüphanesi

import { pool, initDB } from './db.js'; 
import { startSkylineSystem } from './buy-bot.js';
import { startSentimentLoop } from './cron/sentimentJob.js';
// Whale Watcher artık WSS sunucusunu almalı
import { startWhaleWatcher } from './services/whaleWatcher.js'; 

import sentimentRoutes from './routes/sentimentRoutes.js';
import whaleRoutes from './routes/whaleRoutes.js'; 
import bot, { startTelegramBot } from './bot.js';

const app = express();
const PORT = process.env.PORT || 10000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ====================== WSS SUNUCUSU TANIMLAMA ======================
const wss = new ws.Server({ noServer: true }); 
// WSS sunucusunu dışa aktar ki whaleWatcher kullanabilsin
export const getWSS = () => wss;

// ... (MIDDLEWARE ve API ROTLARI aynı kalır) ...
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '10mb' }));
// ... (Helmet ayarları aynı kalır) ...
app.use(express.urlencoded({ extended: true }));

// ====================== TELEGRAM WEBHOOK ROUTE ======================
app.post(`/bot${TOKEN}`, (req, res) => {
  if (bot) { bot.processUpdate(req.body); }
  res.sendStatus(200);
});

// ====================== API ROUTES ======================
app.use('/api', sentimentRoutes);
app.use('/api', whaleRoutes);

// ... (Diğer Endpointler aynı kalır) ...

// ====================== BAŞLATMA (KRİTİK DEĞİŞİKLİK) ======================
const server = app.listen(PORT, async () => {
  await initDB(); 
  console.log(`SKYL backend running on ${PORT}`);
  
  await startTelegramBot(); 
  
  // Whale Watcher'ı WSS sunucusu ile başlat
  startWhaleWatcher(wss); 
  startSkylineSystem();      
  startSentimentLoop();      
});

// WSS BAĞLANTISINI HTTP SERVER'A BAĞLAMA
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

// ... (Kapatma mantığı aynı kalır) ...
