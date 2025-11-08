// src/server.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

/* ---------- Paths ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------- App ---------- */
const app = express();

/* ---------- Security ---------- */
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Render (ve çoğu PaaS) bir reverse proxy arkasında çalışır.
// IP doğruluğu için 'trust proxy' etkin, ama express-rate-limit
// v7'nin agresif validasyon uyarılarını susturuyoruz.
app.set("trust proxy", 1);

/* ---------- CORS ---------- */
const ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Skyl.online ve localhost geliştirme için makul default
const defaultOrigins = [
  "https://skyl.online",
  "https://www.skyl.online",
  "http://localhost:5173",
  "http://localhost:3000",
];

const allowed = ORIGINS.length ? ORIGINS : defaultOrigins;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman vb.
      return allowed.includes(origin) ? cb(null, true) : cb(new Error("CORS blocked"), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
    optionsSuccessStatus: 200,
  })
);

app.use(express.json({ limit: "500kb" }));

/* ---------- Static ---------- */
app.use(express.static(__dirname));

/* ---------- JSON Storage ---------- */
const tasksFile = path.join(__dirname, "tasks.json");
const leaderboardFile = path.join(__dirname, "leaders.json");
const metaFile = path.join(__dirname, "meta.json");

function loadJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8");
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* ---------- Helpers ---------- */
const getIp = (req) =>
  (
    // Render/Cloudflare vs. proxy zinciri
    req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.ip ||
    req.socket?.remoteAddress ||
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

  // JSON’a yazarken Set'leri array'e çevir
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

  // Bellekte tekrar Set’e çevir
  meta.walletsByIp = Object.fromEntries(
    Object.entries(meta.walletsByIp).map(([k, v]) => [k, new Set([...v])])
  );
  meta.walletsByFp = Object.fromEntries(
    Object.entries(meta.walletsByFp).map(([k, v]) => [k, new Set([...v])])
  );
}

/* ---------- Rate Limits ---------- */
// express-rate-limit v7 çok sıkı validasyon yapıyor.
// Render arkasında X-Forwarded-For ve trust proxy nedeniyle
// uyarı basmaması için validate bayraklarını kapatıyoruz.
const commonRateOptions = {
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    // Bu iki satır loga düşen "UNEXPECTED_X_FORWARDED_FOR" ve
    // "PERMISSIVE_TRUST_PROXY" uyarılarını susturur.
    trustProxy: false,
    xForwardedForHeader: false,
  },
};

app.use(
  rateLimit({
    ...commonRateOptions,
    max: 60,
  })
);

const sensitiveLimiter = rateLimit({
  ...commonRateOptions,
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

/* ---------- Endpoints ---------- */

// ✅ Sağlık
app.get("/health", (_req, res) => res.send("OK"));

// ✅ Katılımcı/istatistik
// Frontend'deki gerçek sayaç için.
app.get("/airdrop-stats", (_req, res) => {
  const leaders = loadJSON(leaderboardFile, []);
  const participants = Array.isArray(leaders) ? leaders.length : 0;
  const maxParticipants = 5000;
  const remaining = Math.max(0, maxParticipants - participants);
  res.json({ participants, remaining, maxParticipants });
});

// ✅ Leaderboard
app.get("/get-leaderboard", (_req, res) => {
  res.json(loadJSON(leaderboardFile, []));
});

// ✅ Kullanıcı görevleri – get
app.get("/get-tasks", (req, res) => {
  const wallet = (req.query.wallet || "").toLowerCase();
  if (!wallet) return res.json({ tasks: [] });

  const db = loadJSON(tasksFile, {});
  res.json({ tasks: db[wallet] || [] });
});

// ✅ Kullanıcı görevleri – save
app.post("/save-tasks", sensitiveLimiter, (req, res) => {
  const { wallet, tasks, fp } = req.body || {};
  if (!wallet || !Array.isArray(tasks))
    return res.status(400).json({ success: false, message: "Bad payload" });

  const ip = getIp(req);
  rememberActivity({ ip, fp, wallet: wallet.toLowerCase() });

  const db = loadJSON(tasksFile, {});
  db[wallet.toLowerCase()] = tasks;
  saveJSON(tasksFile, db);

  // Leaderboard puanı
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

// ✅ X (Twitter) doğrulama
app.post("/verify-x", sensitiveLimiter, async (req, res) => {
  try {
    const { username, wallet, fp } = req.body || {};
    if (!username || !wallet)
      return res.status(400).json({ message: "username and wallet required" });

    const ip = getIp(req);
    rememberActivity({ ip, fp, wallet: (wallet || "").toLowerCase() });

    const bearer =
      process.env.TWITTER_BEARER_TOKEN ||
      process.env.X_BEARER_TOKEN || // Eski anahtar ismi için yedek
      "";
    const tweetId =
      process.env.AIRDROP_TWEET_ID ||
      process.env.POST || // Render env ekranında "POST" olarak tutulmuş olabilir
      "";

    if (!bearer || !tweetId) {
      return res
        .status(500)
        .json({ message: "X API not configured (token or tweet id missing)" });
    }

    // 1) Kullanıcı
    const userRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(
        username
      )}?user.fields=created_at,public_metrics,profile_image_url`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );

    if (!userRes.ok) {
      const t = await userRes.text();
      return res.status(400).json({ message: "user lookup failed", detail: t });
    }

    const userData = await userRes.json();
    const user = userData?.data;
    if (!user) return res.status(400).json({ message: "User not found" });

    // 2) Retweet kontrol
    // Not: Büyük RT listelerinde pagination gerekir; airdroplar için 100 yeterli
    const rtRes = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by?max_results=100`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );

    if (!rtRes.ok) {
      const t = await rtRes.text();
      return res
        .status(400)
        .json({ message: "retweet lookup failed", detail: t });
    }

    const rtData = await rtRes.json();
    const didRT = !!rtData?.data?.some((u) => u.id === user.id);
    if (!didRT) return res.status(400).json({ message: "Retweet not found" });

    // 3) Risk skoru
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

// ✅ (opsiyonel) claim öncesi basic risk kontrol
app.post("/pre-claim", sensitiveLimiter, (req, res) => {
  const { wallet, fp } = req.body || {};
  const ip = getIp(req);
  const risk = scoreContext({ ip, fp });
  const hardBlock = risk >= 80;
  res.json({ ok: !hardBlock, risk });
});

/* ---------- Start ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ SKYL backend running on", PORT);
});
