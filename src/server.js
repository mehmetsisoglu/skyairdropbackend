// src/server.js (v3.0 – FULL LOGIC PRESERVED + GRACEFUL SHUTDOWN)
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
// Veritabanı ve Bot başlatıcıyı dışarıdan alıyoruz (Modüler Yapı)
import { pool, initDB } from './db.js'; 
import { startSkylineSystem } from './buy-bot.js';

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

// 1. X (Twitter) Doğrulama (Orijinal Mantık Korundu)
app.post('/verify-x', async (req, res) => {
  console.log('POST /verify-x →', req.body);

  const { username, wallet } = req.body;

  if (!username || !wallet) {
    return res.status(400).json({ message: 'Username ve wallet gerekli' });
  }

  // Orijinal Regex ve Uzunluk Kontrolü
  const cleanUsername = username.startsWith('@') ? username.slice(1) : username.trim();
  if (cleanUsername.length < 1 || cleanUsername.length > 15 || !/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return res.status(400).json({ message: 'Geçersiz X kullanıcı adı' });
  }

  // Şimdilik başarılı dönüyoruz (İleride API eklenebilir)
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
    // db.js üzerinden gelen pool'u kullanıyoruz
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
  // Buraya ileride bot.js'den bir fonksiyon çağırıp Telegram bildirimi ekleyebiliriz
  res.json({ success: true });
});

// Health Check
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'SKYL Airdrop Backend Active', time: new Date().toISOString() });
});

// ====================== SUNUCU BAŞLATMA ======================
const server = app.listen(PORT, async () => {
  // Önce Veritabanı Tablolarını Kontrol Et (db.js'den gelir)
  await initDB();
  
  console.log(`SKYL backend (PostgreSQL) running on ${PORT}`);
  
  // ==> SİSTEMLERİ TEK NOKTADAN BAŞLAT (BuyBot + Telegram)
  console.log("🚀 Skyline Logic Sistemleri Başlatılıyor...");
  startSkylineSystem();
});

// ============================================================
//        GRACEFUL SHUTDOWN (ZOMBİ BOTLARI ÖNLEME)
// ============================================================
// Render yeni deploy yaparken eskisini kapatmak için bu sinyalleri gönderir.
// Bunu dinlemezsek eski bot kapanmaz ve '409 Conflict' hatası verir.

const gracefulShutdown = (signal) => {
  console.log(`[server.js] ${signal} sinyali alındı. Sistem güvenli kapatılıyor...`);
  
  server.close(() => {
    console.log('[server.js] HTTP sunucusu kapatıldı.');
    
    // Veritabanı bağlantısını nazikçe kes
    pool.end(() => {
      console.log('[server.js] Veritabanı bağlantısı kapatıldı.');
      process.exit(0); // İşlemi tamamen bitir
    });
  });

  // Eğer 5 saniye içinde kapanmazsa zorla kapat (Force Kill)
  setTimeout(() => {
    console.error('[server.js] Kapanma zaman aşımı. Zorla kapatılıyor.');
    process.exit(1);
  }, 5000);
};

// Sinyalleri Dinle
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Beklenmedik Hata Yakalama
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
