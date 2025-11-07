// Skyline Logic Backend - Veritabanı + Telegram Bot Sürümü
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// YENİ: PostgreSQL paketini içe aktar
import pg from "pg";
const { Pool } = pg;

// ESKİ KODUNUZDAN: Telegram botu için import
// Lütfen "bot.js" dosyanızın da bu klasörde olduğundan emin olun!
import { sendAirdropClaim } from "./bot.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// YENİ: Veritabanı Bağlantı Havuzu (Connection Pool)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

// Veritabanı bağlantısını test et
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Veritabanı bağlantı hatası:', err.stack);
  }
  console.log('✅ PostgreSQL Veritabanına başarıyla bağlandı!');
  client.release();
});


// Dinamik Puanlama (Aynı kaldı)
const TASK_POINTS = {
    'x': 50,
    'telegram': 10,
    'instagram': 10
};

const app = express();
const DEFAULT_PORT = 3000;
let port = Number(process.env.PORT) || DEFAULT_PORT;

app.use(express.static(path.join(__dirname, '/'))); 
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

// GÜNCELLENDİ: tasks.json okumak yerine veritabanından okur
async function readTasksDB() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT wallet, tasks, last_completed FROM users');
    const dbObject = {};
    for (const row of res.rows) {
      dbObject[row.wallet] = {
        tasks: row.tasks || [],
        lastCompleted: row.last_completed ? parseInt(row.last_completed, 10) : null 
      };
    }
    return dbObject;
  } catch (error) {
    console.error("❌ DB Okuma Hatası (readTasksDB):", error);
    return {}; 
  } finally {
    client.release(); 
  }
}

// GÜNCELLENDİ: Görevleri Yükle Endpoint
app.get("/get-tasks", async (req, res) => {
  const wallet = req.query.wallet ? req.query.wallet.toLowerCase() : null;
  if (!wallet) {
    return res.status(400).json({ success: false, message: "Wallet address required" });
  }

  const client = await pool.connect();
  try {
    const result = await client.query('SELECT tasks FROM users WHERE wallet = $1', [wallet]);
    if (result.rows.length === 0) {
      return res.json({ wallet: wallet, tasks: [] });
    }
    res.json({ wallet: wallet, tasks: result.rows[0].tasks || [] });
  } catch (error) {
    console.error("❌ DB Hatası (/get-tasks):", error);
    res.status(500).json({ success: false, message: "Failed to get tasks" });
  } finally {
    client.release();
  }
});

// GÜNCELLENDİ: Görevleri Kaydet Endpoint
app.post("/save-tasks", async (req, res) => {
  const { wallet, tasks } = req.body;
  if (!wallet || !tasks || !Array.isArray(tasks)) {
    return res.status(400).json({ success: false, message: "Invalid input" });
  }
  
  const lowerWallet = wallet.toLowerCase();
  const newTimestamp = Date.now(); 
  const client = await pool.connect();

  try {
    const query = `
      INSERT INTO users (wallet, tasks, last_completed)
      VALUES ($1, $2, $3)
      ON CONFLICT (wallet) DO UPDATE
      SET tasks = $2, last_completed = $3;
    `;
    await client.query(query, [lowerWallet, tasks, newTimestamp]);
    res.json({ success: true, message: "Tasks saved", wallet: lowerWallet, tasks: tasks });
  } catch (error) {
    console.error("❌ DB Hatası (/save-tasks):", error);
    res.status(500).json({ success: false, message: "Failed to save tasks" });
  } finally {
    client.release();
  }
});

// GÜNCELLENDİ: Leaderboard Endpoint
app.get("/get-leaderboard", async (req, res) => {
    const db = await readTasksDB(); 
    let leaderboard = [];

    for (const wallet in db) {
        let points = 0;
        if (db[wallet].tasks && Array.isArray(db[wallet].tasks)) {
            db[wallet].tasks.forEach(task => {
                points += (TASK_POINTS[task] || 0);
            });
        }
        if (points > 0) {
            leaderboard.push({ 
                wallet: wallet, 
                points: points,
                time: db[wallet].lastCompleted || Date.now() 
            });
        }
    }

    leaderboard.sort((a, b) => {
        if (a.points !== b.points) {
            return b.points - a.points; 
        }
        return a.time - b.time; 
    });

    const top10 = leaderboard.slice(0, 10);
    res.json(top10);
});


// GÜNCELLENDİ: X (Twitter) Doğrulama Endpoint
app.post("/verify-x", async (req, res) => {
  const { username } = req.body;
  const BEARER_TOKEN = process.env.X_BEARER_TOKEN;
  const AIRDROP_TWEET_ID = process.env.AIRDROP_TWEET_ID; 

  if (!username) {
    return res.status(400).json({ message: "❌ Username is required." });
  }
  if (!AIRDROP_TWEET_ID || !BEARER_TOKEN) {
    console.error("❌ SUNUCU AYAR HATASI: X_BEARER_TOKEN veya AIRDROP_TWEET_ID .env dosyasında eksik.");
    return res.status(500).json({ message: "⚠️ Server configuration error." });
  }

  try {
    // === AŞAMA 1 ===
    const userLookupResponse = await fetch(`https://api.x.com/2/users/by/username/${username}`, {
      headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
    });
    const userData = await userLookupResponse.json();
    if (!userLookupResponse.ok || !userData?.data?.id) {
      console.error(`❌ X API HATASI (Aşama 1): Kullanıcı '${username}' bulunamadı.`);
      return res.status(404).json({ message: `⚠️ User '${username}' not found.` });
    }
    const userId = userData.data.id;
    console.log(`✅ AŞAMA 1 BAŞARILI: '${username}' bulundu. ID: ${userId}`);

    // === AŞAMA 2 ===
    const tweetLookupUrl = `https://api.x.com/2/users/${userId}/tweets?tweet.fields=referenced_tweets&max_results=100`;
    const tweetLookupResponse = await fetch(tweetLookupUrl, {
      headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
    });
    const tweetData = await tweetLookupResponse.json();
    if (!tweetLookupResponse.ok) {
       console.error(`❌ X API HATASI (Aşama 2): Kullanıcının tweetleri çekilemedi. ID: ${userId}`);
       return res.status(500).json({ message: "⚠️ Could not check user's tweets." });
    }

    // === AŞAMA 3 ===
    let retweetFound = false;
    if (tweetData.data && Array.isArray(tweetData.data)) {
        for (const tweet of tweetData.data) {
            if (tweet.referenced_tweets && Array.isArray(tweet.referenced_tweets)) {
                for (const refTweet of tweet.referenced_tweets) {
                    if ((refTweet.type === 'retweeted' || refTweet.type === 'quoted') && refTweet.id === AIRDROP_TWEET_ID) {
                        retweetFound = true;
                        break; 
                    }
                }
            }
            if (retweetFound) break; 
        }
    }
    if (retweetFound) {
        console.log(`✅ AŞAMA 3 BAŞARILI: '${username}' tweet'i (${AIRDROP_TWEET_ID}) retweetlemiş (veya alıntılamış).`);
        return res.json({ message: "✅ Verified! Retweet found." });
    } else {
        console.warn(`❌ AŞAMA 3 BAŞARISIZ: '${username}' tweet'i (${AIRDROP_TWEET_ID}) retweetlememiş (veya son 100 tweet'i arasında değil).`);
        return res.status(400).json({ message: "⚠️ Verification failed. Airdrop post retweet not found in your recent tweets." });
    }

  } catch (error) {
    console.error("❌ SUNUCU HATASI (Catch):", error);
    res.status(500).json({ message: "⚠️ Internal server error." });
  }
});

// ESKİ KODUNUZDAN: TELEGRAM'A AIRDROP CLAIM BİLDİRİMİ
app.post("/notify-claim", async (req, res) => {
  try {
    const { wallet, amount } = req.body;

    if (!wallet || !amount) {
      return res.status(400).json({ error: "missing wallet or amount" });
    }

    await sendAirdropClaim({ wallet, amount });

    return res.json({ ok: true });
  } catch (e) {
    console.error("claim notify error:", e);
    res.status(500).json({ error: true });
  }
});


// Sunucu Başlatma
app.listen(port, () => {
    console.log(`✅ Sunucu ${port} portunda çalışıyor.`);
    console.log(`Lokal adres: http://localhost:${port}`);
});