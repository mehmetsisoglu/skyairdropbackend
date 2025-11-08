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

const app = express();

/* ---------- Behind proxy (Render/CF) ---------- */
// ERROR: 'X-Forwarded-For ... trust proxy false' uyarısı için şart
app.set("trust proxy", 1);

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

const corsCfg = {
  origin: (origin, cb) => {
    if (!origin || ORIGINS.length === 0) return cb(null, true);
    return ORIGINS.includes(origin)
      ? cb(null, true)
      : cb(new Error("CORS blocked"), false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsCfg));
app.options("*", cors(corsCfg));

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
    return JSON.parse(fs.readFileSync(file));
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

  // JSON dosyasına Set yazamayız, array'e çevirip yazıyoruz
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

  // Bellekte tekrar Set'e döndür
  meta.walletsByIp = Object.fromEntries(
    Object.entries(meta.walletsByIp).map(([k, v]) => [k, new Set([...v])])
  );
  meta.walletsByFp = Object.fromEntries(
    Object.entries(meta.walletsByFp).map(([k, v]) => [k, new Set([...v])])
  );
}

/* ---------- Rate Limits ---------- */
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
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

  const ipWallets = meta.walletsByIp[ip] ? meta.walletsByIp[ip].size : 0;
  if (ipWallets > MAX_WALLETS_PER_IP_24H) s += 40;

  if (fp) {
    const fpWallets = meta.walletsByFp[fp] ? meta.walletsByFp[fp].size : 0;
    if (fpWallets > MAX_WALLETS_PER_FP_24H) s += 40;
  }

  return s;
}

/* ---------- Endpoints ---------- */

// (Opsiyonel) Frontend tarafı isterse 404 olmasın diye
app.get("/airdrop-stats", (req, res) => {
  const leaders = loadJSON(leaderboardFile, []);
  const participants = Array.isArray(leaders) ? leaders.length : 0;
  const max = 5000;
  const remaining = Math.max(0, max - participants);
  res.json({ participants, remaining, max });
});

// ✅ Leaderboard
app.get("/get-leaderboard", (req, res) => {
  res.json(loadJSON(leaderboardFile, []));
});

// ✅ Tasks get
app.get("/get-tasks", (req, res) => {
  const wallet = (req.query.wallet || "").toLowerCase();
  if (!wallet) return res.json({ tasks: [] });

  const db = loadJSON(tasksFile, {});
  res.json({ tasks: db[wallet] || [] });
});

// ✅ Task save
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

// ✅ X verify
app.post("/verify-x", sensitiveLimiter, async (req, res) => {
  try {
    const { username, wallet, fp } = req.body || {};
    if (!username) return res.status(400).json({ message: "Username required" });

    const ip = getIp(req);
    rememberActivity({ ip, fp, wallet: (wallet || "").toLowerCase() });

    // Render değişken adları: X_BEARER_TOKEN veya TWITTER_BEARER_TOKEN
    const bearer =
      process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN;
    const tweetId = process.env.AIRDROP_TWEET_ID;

    if (!bearer || !tweetId) {
      return res
        .status(500)
        .json({ message: "X API not configured", need: ["X_BEARER_TOKEN or TWITTER_BEARER_TOKEN", "AIRDROP_TWEET_ID"] });
    }

    // 1) User info
    const userRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(
        username
      )}?user.fields=created_at,public_metrics,profile_image_url`,
      {
        headers: { Authorization: `Bearer ${bearer}` },
      }
    );
    const userData = await userRes.json();
    const user = userData?.data;
    if (!user) return res.status(400).json({ message: "User not found" });

    // 2) Retweet check
    const rtRes = await fetch(
      `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by?max_results=100`,
      { headers: { Authorization: `Bearer ${bearer}` } }
    );
    const rtData = await rtRes.json();
    const didRT = !!rtData?.data?.some((u) => u.id === user.id);
    if (!didRT) return res.status(400).json({ message: "Retweet not found" });

    // 3) Risk Score
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

// ✅ Pre-claim (opsiyonel)
app.post("/pre-claim", sensitiveLimiter, (req, res) => {
  const { wallet, fp } = req.body || {};
  const ip = getIp(req);
  const risk = scoreContext({ ip, fp });
  const hardBlock = risk >= 80;
  res.json({ ok: !hardBlock, risk });
});

// ✅ Health
app.get("/health", (req, res) => res.send("OK"));

/* ---------- Start ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("✅ SKYL backend running on", PORT)
);
