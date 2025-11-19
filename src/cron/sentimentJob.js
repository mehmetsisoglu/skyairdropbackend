import { getLatestCryptoNews } from '../services/newsFetcher.js';
import { analyzeNewsBatch } from '../services/aiService.js';
import { pool } from '../db.js';

let isRunning = false;

// Tablo yoksa otomatik oluştur (Self-Healing Architecture)
async function ensureTableExists() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS market_sentiment (
      id SERIAL PRIMARY KEY,
      batch_id UUID DEFAULT gen_random_uuid(),
      news_source VARCHAR(255),
      headline TEXT NOT NULL,
      sentiment_score INT,
      risk_score INT,
      ai_summary TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log('[Database] Market Sentiment tablosu kontrol edildi/oluşturuldu.');
  } catch (err) {
    console.error('[Database] Tablo oluşturma hatası:', err.message);
  }
}

export async function runSentimentAnalysis() {
  if (isRunning) return;
  isRunning = true;

  console.log('🤖 Hyper Logic AI: Analiz döngüsü başladı...');

  try {
    // 1. Haber Çek
    const news = await getLatestCryptoNews();
    if (!news.length) throw new Error("Haber kaynağı boş.");

    // 2. AI Analiz
    const analysisResults = await analyzeNewsBatch(news);
    if (!analysisResults) throw new Error("AI yanıt vermedi.");

    // 3. Kaydet
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Batch ID oluştur (uuid-ossp eklentisi yoksa diye javascript ile id üretebiliriz ama gen_random_uuid genelde vardır)
      // Garanti olması için basit bir batch ID yapalım
      const batchIdRes = await client.query('SELECT gen_random_uuid()'); 
      const batchId = batchIdRes.rows[0].gen_random_uuid;

      for (const item of analysisResults) {
        // Orjinal kaynağı bul
        const sourceNews = news.find(n => item.headline.includes(n.title.substring(0, 15))) || { source: 'Unknown' };

        await client.query(
          `INSERT INTO market_sentiment 
           (batch_id, news_source, headline, sentiment_score, risk_score, ai_summary)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [batchId, sourceNews.source, item.headline, item.sentiment_score, item.risk_score, item.summary]
        );
      }

      await client.query('COMMIT');
      console.log('✅ Hyper Logic AI: Veriler başarıyla kaydedildi.');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('[SentimentJob] Hata:', err.message);
  } finally {
    isRunning = false;
  }
}

export async function startSentimentLoop() {
  await ensureTableExists(); // Başlarken tabloyu kontrol et
  
  runSentimentAnalysis(); // Hemen bir kez çalıştır

  // Her 4 saatte bir (14400000 ms) tekrarla
  setInterval(runSentimentAnalysis, 14400000);
}