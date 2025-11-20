// src/routes/whaleRoutes.js (FINAL FIX: Excluding known noisy addresses)
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Borsa içi fon süpürme gürültüsünü filtrelemek için adres listesi
// DİKKAT: Bu adresleri sadece test amaçlı ekliyoruz. Kendi borsa adresiniz olmadığından emin olun.
const NOISY_WHALE_ADDRESSES = [
    '0x8F735D8C1f3640b3780D7e3B26955aC441e8f399', // 114k BNB sweep (örnek)
    '0x0a3d348a03A8d484196B9959588cbaa2d99f334242', // Alıcı adres (örnek)
];

// GET /api/whales
router.get('/whales', async (req, res) => {
  try {
    const addressesToExclude = NOISY_WHALE_ADDRESSES.map(addr => addr.toLowerCase());

    // Sorguya Gürültü Filtresini ve Görsel Tekilleştirmeyi Ekle
    const result = await pool.query(
      `SELECT DISTINCT ON (amount, to_address) 
       amount, to_address, from_address, tx_hash, created_at, amount_usd 
       FROM whale_alerts 
       WHERE LOWER(from_address) <> ALL($1) 
       AND LOWER(to_address) <> ALL($1) 
       ORDER BY amount, to_address, created_at DESC 
       LIMIT 20`,
       [addressesToExclude]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Whale API Hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
