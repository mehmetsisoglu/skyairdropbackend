// src/routes/sentimentRoutes.js
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// GET /api/sentiment
// En son analiz edilen haberleri ve risk puanlarını getirir
router.get('/sentiment', async (req, res) => {
  try {
    // 1. En son eklenen analiz grubunu (batch) bul
    const latestBatchQuery = await pool.query(
      'SELECT batch_id, created_at FROM market_sentiment ORDER BY created_at DESC LIMIT 1'
    );

    if (latestBatchQuery.rows.length === 0) {
      return res.json({ 
        meta: { analysis_time: null, average_risk: 0, average_sentiment: 0 },
        data: [],
        summary: "Henüz analiz verisi yok." 
      });
    }

    const latestBatchId = latestBatchQuery.rows[0].batch_id;
    const analysisTime = latestBatchQuery.rows[0].created_at;

    // 2. O gruba ait tüm haber detaylarını çek
    const result = await pool.query(
      'SELECT * FROM market_sentiment WHERE batch_id = $1',
      [latestBatchId]
    );

    // 3. İstatistikleri Hesapla
    const rows = result.rows;
    const totalRisk = rows.reduce((acc, item) => acc + (item.risk_score || 0), 0);
    const totalSentiment = rows.reduce((acc, item) => acc + (item.sentiment_score || 0), 0);

    const avgRisk = rows.length > 0 ? Math.round(totalRisk / rows.length) : 0;
    const avgSentiment = rows.length > 0 ? Math.round(totalSentiment / rows.length) : 0;

    // 4. Frontend'e Temiz JSON Gönder
    res.json({
      meta: {
        analysis_time: analysisTime,
        average_risk: avgRisk,      // 0 (Güvenli) - 100 (Tehlikeli)
        average_sentiment: avgSentiment, // -100 (Kötü) - +100 (İyi)
        news_count: rows.length
      },
      data: rows // Haberlerin listesi
    });

  } catch (error) {
    console.error('[API] Sentiment Hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;