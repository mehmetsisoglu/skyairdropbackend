// src/routes/whaleRoutes.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /api/whales
router.get('/whales', async (req, res) => {
  try {
    // 🐋 FIX: Sadece görsel olarak birbirinden farklı olan son 20 işlemi getir (Aynı BNB miktarları tekrarlanmaz)
    const result = await pool.query(
      `SELECT DISTINCT ON (amount, to_address) 
       amount, to_address, from_address, tx_hash, created_at, amount_usd 
       FROM whale_alerts 
       ORDER BY amount, to_address, created_at DESC 
       LIMIT 20`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Whale API Hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
