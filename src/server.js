import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import fetch from "node-fetch";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(express.json());
app.use(cors());

// ============================================
// ✅ Render CORS
// ============================================
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["https://skyl.online"];

app.use(
  cors({
    origin: allowedOrigins,
    methods: "GET,POST,OPTIONS",
  })
);

// ============================================
// ✅ DB
// ============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ============================================
// ✅ Rate limit
// ============================================
app.set("trust proxy", 1);

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 1000,
  max: 10,
});

// ============================================
// ✅ RISK SCORE HESABI (EN BASİT FORM)
// ============================================
async function computeRiskScore(wallet) {
  try {
    let score = 0;

    // 1) Kullanıcı kayıtlı mı?
    const user = await pool.query(
      "SELECT * FROM users WHERE wallet = $1 LIMIT 1",
      [wallet]
    );

    if (!user.rows.length) return 50; // kayıt yok → nötr risk

    const u = user.rows[0];

    // 2) X doğrulanmamış → risk+
    if (!u.x_verified) score += 40;

    // 3) Tweet kontrolü yapılmamış → risk+
    if (!u.tweet_verified) score += 30;

    // 4) Telegram yok → risk+
    if (!u.telegram_verified) score += 20;

    // 5) Instagram yok → risk+
    if (!u.instagram_verified) score += 10;

    // 6) Çok hızlı tekrar deneme → risk+
    const now = Date.now();
    if (u.last_claim_time) {
      const diff = now - Number(u.last_claim_time);
      if (diff < 15000) score += 50;
    }

    return Math.min(score, 100);
  } catch (e) {
    console.error("riskScore error:", e);
    return 50;
  }
}

// ============================================
// ✅ /pre-claim → Claim öncesi güvenlik kontrolü
// ============================================
app.post("/pre-claim", sensitiveLimiter, async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet)
      return res.status(400).json({ ok: false, message: "Missing wallet" });

    const riskScore = await computeRiskScore(wallet);

    // ✅ FULL BLOCK
    if (riskScore >= 80) {
      return res.json({
        ok: false,
        canClaim: false,
        riskScore,
        status: "blocked",
      });
    }

    // ✅ SOFT BLOCK
    if (riskScore >= 40 && riskScore < 80) {
      return res.json({
        ok: false,
        canClaim: false,
        riskScore,
        status: "soft_block",
        waitSeconds: 15,
      });
    }

    // ✅ ALLOWED
    return res.json({
      ok: true,
      canClaim: true,
      riskScore,
      status: "allowed",
    });
  } catch (err) {
    console.error("pre-claim error:", err);
    return res.status(500).json({ ok: false, message: "server error" });
  }
});

// ============================================
// ✅ Mevcut endpointler (SEND FAKE)
// ============================================

// → GET tasks
app.get("/get-tasks", async (req, res) => {
  const { wallet } = req.query;

  const tasks = await pool.query(
    "SELECT * FROM users WHERE wallet = $1 LIMIT 1",
    [wallet]
  );

  if (!tasks.rows.length) {
    return res.json({
      x: false,
      telegram: false,
      instagram: false,
      points: 0,
    });
  }

  const u = tasks.rows[0];

  res.json({
    x: u.x_verified,
    telegram: u.telegram_verified,
    instagram: u.instagram_verified,
    points: u.points || 0,
  });
});

// → X Verify (fake success)
app.post("/verify-x", async (req, res) => {
  const { wallet } = req.body;

  await pool.query(
    `
    INSERT INTO users (wallet, x_verified, points)
    VALUES ($1, true, 50)
    ON CONFLICT (wallet)
    DO UPDATE SET x_verified = true, points = users.points + 50
  `,
    [wallet]
  );

  res.json({ ok: true, status: "verified_x" });
});

// → Telegram verify
app.post("/verify-telegram", async (req, res) => {
  const { wallet } = req.body;

  await pool.query(
    `
      UPDATE users SET telegram_verified = true, points = points + 10
      WHERE wallet = $1
    `,
    [wallet]
  );

  res.json({ ok: true });
});

// → Instagram verify
app.post("/verify-instagram", async (req, res) => {
  const { wallet } = req.body;

  await pool.query(
    `
      UPDATE users SET instagram_verified = true, points = points + 10
      WHERE wallet = $1
    `,
    [wallet]
  );

  res.json({ ok: true });
});

// ============================================
// ✅ SERVER
// ============================================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`✅ SKYL backend running on ${PORT}`);
});
