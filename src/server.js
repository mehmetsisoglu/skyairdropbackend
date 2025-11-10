// =======================================================
// Skyline Logic Airdrop Backend v2.1 (Temizlenmiş Sürüm)
// =======================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import dotenv from "dotenv";
import pkg from 'pg'; 
import { sendAirdropClaim } from "./bot.js"; // bot.js'den bildirim fonksiyonunu al

// --- Veritabanı ve Çevre Değişkenleri ---
dotenv.config();
const { Pool } = pkg;

/* ---------- Paths ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ---------- Database (PostgreSQL) ---------- */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

const initializeDatabase = async () => {
  const tasksTableQuery = `
    CREATE TABLE IF NOT EXISTS airdrop_tasks (
      wallet VARCHAR(42) PRIMARY KEY,
      tasks TEXT[] DEFAULT ARRAY[]::TEXT[],
      points INTEGER DEFAULT 0,
      twitter_user VARCHAR(100)
    );
  `;
  const activityLogQuery = `
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      wallet VARCHAR(42),
      ip_address VARCHAR(45),
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await pool.query(tasksTableQuery);
    await pool.query(activityLogQuery);
    console.log("[server.js] ✅ Veritabanı tabloları başarıyla kontrol edildi/oluşturuldu.");
  } catch (e) {
    console.error("[server.js] ❌ Veritabanı tablosu oluşturulamadı:", e);
    process.exit(1); 
  }
};
initializeDatabase();

// PROXY'E GÜVEN (RENDER İÇİN KRİTİK)
app.set('trust proxy', 1);

/* ---------- Security ---------- */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

/* ---------- CORS ---------- */
const ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ORIGINS.length === 0) return cb(null, true);
      return ORIGINS.includes(origin)
        ? cb(null, true)
        : cb(new Error("CORS blocked"), false);
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json({ limit: "500kb" }));

/* ---------- Static ---------- */
app.use(express.static(path.join(__dirname, '..'))); // Ana dizindeki dosyaları (index.html, main.js) sunar

/* ---------- Helpers ---------- */
const getIp = (req) =>
  (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    ""
  ).toString();

/* ---------- Meta Tracking (Veritabanı Versiyonu) ---------- */
async function rememberActivity({ ip, wallet }) {
  try {
    const query = `
      INSERT INTO activity_log (wallet, ip_address)
      VALUES ($1, $2);
    `;
    await pool.query(query, [wallet, ip]);
  } catch (e) {
    console.error("[server.js] Activity log hatası:", e);
  }
}

/* ---------- Rate Limits ---------- */
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
  })
);

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
});

/* ---------- Risk Scoring (Veritabanı Versiyonu) ---------- */
const MIN_FOLLOWERS = parseInt(process.env.MIN_FOLLOWERS || "5", 10);
const MIN_ACCOUNT_AGE_DAYS = parseInt(
  process.env.MIN_ACCOUNT_AGE_DAYS || "7",
  10
);
const REQUIRE_PROFILE_IMAGE =
  (process.env.REQUIRE_PROFILE_IMAGE || "true") === "true";
const MAX_WALLETS_PER_IP_24H = parseInt(
  process.env.MAX_WALLETS_PER_IP_24H || "5",
  10
);

function scoreTwitterUser(u) {
  let score = 0;
  const created = new Date(u.created_at).getTime();
  const ageDays = (Date.now() - created) / (24 * 3600 * 1000);

  if ((u.public_metrics?.followers_count || 0) < MIN_FOLLOWERS) score += 40;
  if (ageDays < MIN_ACCOUNT_AGE_DAYS) score += 40;
  if (
    REQUIRE_PROFILE_IMAGE &&
    (u.profile_image_url?.includes("default_profile_images") ||
      !u.profile_image_url)
  )
    score += 20;

  return score;
}

async function scoreContext({ ip }) {
  let s = 0;
  try {
    const query = `
      SELECT COUNT(DISTINCT wallet) FROM activity_log
      WHERE ip_address = $1 AND timestamp > NOW() - INTERVAL '24 hours';
    `;
    const result = await pool.query(query, [ip]);
    const ipWallets = parseInt(result.rows[0].count, 10);
    
    if (ipWallets > MAX_WALLETS_PER_IP_24H) s += 40;
  } catch (e) {
    console.error("[server.js] Score context hatası:", e);
  }
  return s;
}

/* ---------- Endpoints (Veritabanı Versiyonu) ---------- */

app.get("/get-leaderboard", async (req, res) => {
  try {
    const query = `
      SELECT wallet, points FROM airdrop_tasks
      ORDER BY points DESC
      LIMIT 10;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (e) {
    console.error("[server.js] Error /get-leaderboard:", e);
    res.status(500).json([]);
  }
});

app.get("/get-tasks", async (req, res) => {
  const wallet = (req.query.wallet || "").toLowerCase();
  if (!wallet) return res.json({ tasks: [] });

  try {
    const query = "SELECT tasks FROM airdrop_tasks WHERE wallet = $1";
    const result = await pool.query(query, [wallet]);

    if (result.rows.length > 0) {
      res.json({ tasks: result.rows[0].tasks || [] });
    } else {
      res.json({ tasks: [] }); 
    }
  } catch (e) {
    console.error("[server.js] Error /get-tasks:", e);
    res.status(500).json({ tasks: [] });
  }
});

app.get("/airdrop-stats", async (req, res) => {
  try {
    const query = "SELECT COUNT(wallet) FROM airdrop_tasks";
    const result = await pool.query(query);
    
    const participants = parseInt(result.rows[0].count, 10);
    const remaining = Math.max(0, 5000 - participants);
    
    res.json({ participants, remaining });
  } catch (e) {
    console.error("[server.js] Error /airdrop-stats:", e);
    res.status(500).json({ participants: 0, remaining: 5000 });
  }
});

app.post("/save-tasks", sensitiveLimiter, async (req, res) => {
  const { wallet, tasks } = req.body || {};
  if (!wallet || !Array.isArray(tasks))
    return res.status(400).json({ success: false });

  const ip = getIp(req);
  const lowerWallet = wallet.toLowerCase();
  
  await rememberActivity({ ip, wallet: lowerWallet });

  const points =
    (tasks.includes("x") ? 50 : 0) +
    (tasks.includes("telegram") ? 10 : 0) +
    (tasks.includes("instagram") ? 10 : 0);

  try {
    const query = `
      INSERT INTO airdrop_tasks (wallet, tasks, points)
      VALUES ($1, $2, $3)
      ON CONFLICT (wallet) 
      DO UPDATE SET 
        tasks = $2,
        points = $3;
    `;
    await pool.query(query, [lowerWallet, tasks, points]);
    res.json({ success: true });

  } catch (e) {
    console.error("[server.js] Error /save-tasks:", e);
    res.status(500).json({ success: false, message: "Veritabanı kaydı başarısız." });
  }
});

app.post("/verify-x", sensitiveLimiter, async (req, res) => {
  try {
    const { username, wallet } = req.body || {};
    if (!username) return res.status(400).json({ message: "Username required" });

    const ip = getIp(req);
    const lowerWallet = (wallet || "").toLowerCase();

    await rememberActivity({ ip, wallet: lowerWallet });

    const bearer = process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN;
    const tweetId = process.env.AIRDROP_TWEET_ID;
    if (!bearer || !tweetId)
      return res.status(500).json({ message: "X API not configured" });

    const userRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(
        username
      )}?user.fields=created_at,public_metrics,profile_image_url`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );

    const userData = await userRes.json();
    const user = userData?.data;
    if (!user) return res.status(400).json({ message: "User not found" });

    const rtRes = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by?max_results=100`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );
    const rtData = await rtRes.json();
    const didRT = !!rtData?.data?.some((u) => u.id === user.id);

    if (!didRT) return res.status(400).json({ message: "Retweet not found" });

    const twitterScore = scoreTwitterUser(user);
    const ctxScore = await scoreContext({ ip }); 
    const risk = twitterScore + ctxScore;

    try {
      const query = `
        INSERT INTO airdrop_tasks (wallet, twitter_user)
        VALUES ($1, $2)
        ON CONFLICT (wallet) 
        DO UPDATE SET twitter_user = $2;
      `;
      await pool.query(query, [lowerWallet, user.username]);
    } catch (e) {
      console.error("[server.js] Error saving twitter username:", e);
    }
    
    return res.json({
      success: true,
      risk,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error("[server.js] verify-x error:", err);
    return res.status(500).json({ message: "Twitter API error" });
  }
});

app.post("/pre-claim", sensitiveLimiter, async (req, res) => {
  const { wallet } = req.body || {};
  const ip = getIp(req);
  const risk = await scoreContext({ ip }); 
  const hardBlock = risk >= 80;
  res.json({ ok: !hardBlock, risk });
});

// YENİ ENDPOINT: Airdrop Claim Bildirimi
app.post("/notify-claim", sensitiveLimiter, async (req, res) => {
  const { wallet } = req.body;
  const amount = 100000; // Kişi başı 100,000 SKYL
  
  if (!wallet) return res.status(400).json({ success: false });

  try {
    await sendAirdropClaim({ wallet, amount });
    res.json({ success: true });
  } catch (e) {
    console.error("[server.js] Telegram bildirim hatası (notify-claim):", e);
    res.status(500).json({ success: false });
  }
});


app.get("/health", (req, res) => res.send("OK"));

/* ---------- Start ---------- */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`[server.js] ✅ SKYL backend (PostgreSQL) running on`, PORT)
);
