import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /api/whales
router.get('/whales', async (req, res) => {
  try {
    // En son yakalanan 50 balina hareketini getir
    const result = await pool.query(
      'SELECT * FROM whale_alerts ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Whale API Hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
