import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";
import pkg from 'pg'; // <- BUNU EKLEYİN
// bot.js'den bildirim fonksiyonunu içe aktar
import { sendAirdropClaim } from "./bot.js";
const { Pool } = pkg;  // <- BUNU EKLEYİN
dotenv.config();

/* ---------- Paths ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// PROXY'E GÜVEN (RENDER İÇİN KRİTİK)
// Bu satır, rate-limit'ten ÖNCE gelmeli!
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
app.use(express.static(__dirname));

/* ---------- Database (PostgreSQL) ---------- */
// Veritabanı bağlantı havuzunu (pool) oluştur
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Render.com bağlantıları için bu gereklidir
  }
});

// Sunucu başladığında veritabanı tablolarının var olduğundan emin ol
const initializeDatabase = async () => {
  // Airdrop görevlerini ve puanları tutacak ana tablo
  const tasksTableQuery = `
    CREATE TABLE IF NOT EXISTS airdrop_tasks (
      wallet VARCHAR(42) PRIMARY KEY,
      tasks TEXT[] DEFAULT ARRAY[]::TEXT[],
      points INTEGER DEFAULT 0,
      twitter_user VARCHAR(100)
    );
  `;
  
  // IP/FP loglarını tutacak meta tablo (JSON'daki metaFile yerine)
  const activityLogQuery = `
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      wallet VARCHAR(42),
      ip_address VARCHAR(45),
      fp_hash VARCHAR(100),
      timestamp TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  try {
    await pool.query(tasksTableQuery);
    await pool.query(activityLogQuery);
    console.log("✅ Veritabanı tabloları başarıyla kontrol edildi/oluşturuldu.");
  } catch (e) {
    console.error("❌ Veritabanı tablosu oluşturulamadı:", e);
    // Hata ciddiyse sunucuyu durdur
    process.exit(1);
  }
};

/* ---------- Helpers ---------- */
const getIp = (req) =>
  (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    ""
  ).toString();

const now = () => Date.now();
const within = (ms, t) => now() - t <= ms;

/* ---------- Meta Tracking ---------- */
let meta = loadJSON(metaFile, {
  ip: {},
  fp: {},
  walletsByIp: {},
  walletsByFp: {},
});

function rememberActivity({ ip, fp, wallet }) {
  const ts = now();

  meta.ip[ip] ||= [];
  meta.ip[ip].push(ts);
  meta.ip[ip] = meta.ip[ip].filter((t) => within(24 * 3600 * 1000, t));

  if (fp) {
    meta.fp[fp] ||= [];
    meta.fp[fp].push(ts);
    meta.fp[fp] = meta.fp[fp].filter((t) => within(24 * 3600 * 1000, t));
  }

  meta.walletsByIp[ip] ||= new Set();
  meta.walletsByIp[ip].add(wallet);

  if (fp) {
    meta.walletsByFp[fp] ||= new Set();
    meta.walletsByFp[fp].add(wallet);
  }

  saveJSON(metaFile, {
    ip: meta.ip,
    fp: meta.fp,
    walletsByIp: Object.fromEntries(
      Object.entries(meta.walletsByIp).map(([k, v]) => [k, [...v]])
    ),
    walletsByFp: Object.fromEntries(
      Object.entries(meta.walletsByFp).map(([k, v]) => [k, [...v]])
    ),
  });

  meta.walletsByIp = Object.fromEntries(
    Object.entries(meta.walletsByIp).map(([k, v]) => [k, new Set([...v])])
  );
  meta.walletsByFp = Object.fromEntries(
    Object.entries(meta.walletsByFp).map(([k, v]) => [k, new Set([...v])])
  );
}

/* ---------- Rate Limits ---------- */
app.set('trust proxy', 1); // IMPORTANT: trust proxy so X-Forwarded-For is allowed (for Render/nginx)

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

/* ---------- Risk Scoring ---------- */
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
const MAX_WALLETS_PER_FP_24H = parseInt(
  process.env.MAX_WALLETS_PER_FP_24H || "3",
  10
);

function scoreTwitterUser(u) {
  let score = 0;
  const created = new Date(u.created_at).getTime();
  const ageDays = (now() - created) / (24 * 3600 * 1000);

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

function scoreContext({ ip, fp }) {
  let s = 0;

  const ipWallets = meta.walletsByIp[ip]
    ? meta.walletsByIp[ip].size
    : 0;
  if (ipWallets > MAX_WALLETS_PER_IP_24H) s += 40;

  if (fp) {
    const fpWallets = meta.walletsByFp[fp]
      ? meta.walletsByFp[fp].size
      : 0;
    if (fpWallets > MAX_WALLETS_PER_FP_24H) s += 40;
  }

  return s;
}

// === YENİ ENDPOINT: Airdrop Claim Bildirimi ===
app.post("/notify-claim", sensitiveLimiter, async (req, res) => {
  const { wallet } = req.body;

  // Airdrop havuzu 500M, katılımcı 5,000. Kişi başı 100,000 SKYL.
  const amount = 100000; 

  if (!wallet) return res.status(400).json({ success: false });

  try {
    // bot.js'deki fonksiyonu çağır
    await sendAirdropClaim({ wallet, amount });
    res.json({ success: true });
  } catch (e) {
    console.error("Telegram bildirim hatası (notify-claim):", e);
    res.status(500).json({ success: false });
  }
});

/* ---------- Endpoints ---------- */

app.get("/get-leaderboard", (req, res) => {
  res.json(loadJSON(leaderboardFile, []));
});

app.get("/get-tasks", (req, res) => {
  const wallet = (req.query.wallet || "").toLowerCase();
  if (!wallet) return res.json({ tasks: [] });

  const db = loadJSON(tasksFile, {});
  res.json({ tasks: db[wallet] || [] });
});

//
// === YENİ EKLENEN ENDPOINT BAŞLANGICI ===
//
app.get("/airdrop-stats", (req, res) => {
  try {
    // Katılımcı verilerini 'tasks.json' dosyasından yükle
    const db = loadJSON(tasksFile, {});
    
    // 'db' objesindeki anahtar (cüzdan) sayısını say
    const participants = Object.keys(db).length; 
    const remaining = Math.max(0, 5000 - participants); // 5000 olan toplam limitten düş
    
    // Veriyi main.js'in beklediği formatta gönder
    res.json({ participants, remaining });

  } catch (e) {
    console.error("Error getting /airdrop-stats:", e);
    // Hata olursa, frontend'in bozulmaması için varsayılan bir değer gönder
    res.status(500).json({ participants: 0, remaining: 5000 });
  }
});
//
// === YENİ EKLENEN ENDPOINT BİTİŞİ ===
//

app.post("/save-tasks", sensitiveLimiter, (req, res) => {
  const { wallet, tasks, fp } = req.body || {};
  if (!wallet || !Array.isArray(tasks))
    return res.status(400).json({ success: false });

  const ip = getIp(req);
  rememberActivity({ ip, fp, wallet: wallet.toLowerCase() });

  const db = loadJSON(tasksFile, {});
  db[wallet.toLowerCase()] = tasks;
  saveJSON(tasksFile, db);

  let leaders = loadJSON(leaderboardFile, []);
  const points =
    (tasks.includes("x") ? 50 : 0) +
    (tasks.includes("telegram") ? 10 : 0) +
    (tasks.includes("instagram") ? 10 : 0);

  const idx = leaders.findIndex(
    (l) => l.wallet.toLowerCase() === wallet.toLowerCase()
  );

  if (idx >= 0) leaders[idx].points = points;
  else leaders.push({ wallet, points });

  leaders.sort((a, b) => (b.points || 0) - (a.points || 0));
  saveJSON(leaderboardFile, leaders);

  res.json({ success: true });
});

app.post("/verify-x", sensitiveLimiter, async (req, res) => {
  try {
    const { username, wallet, fp } = req.body || {};
    if (!username) return res.status(400).json({ message: "Username required" });

    const ip = getIp(req);
    rememberActivity({ ip, fp, wallet: (wallet || "").toLowerCase() });

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
    const ctxScore = scoreContext({ ip, fp });
    const risk = twitterScore + ctxScore;

    return res.json({
      success: true,
      risk,
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    console.error("verify-x error:", err);
    return res.status(500).json({ message: "Twitter API error" });
  }
});

app.post("/pre-claim", sensitiveLimiter, (req, res) => {
  const { wallet, fp } = req.body || {};
  const ip = getIp(req);
  const risk = scoreContext({ ip, fp });
  const hardBlock = risk >= 80;
  res.json({ ok: !hardBlock, risk });
});

app.get("/health", (req, res) => res.send("OK"));

/* ---------- Start ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("✅ SKYL backend running on", PORT)
);