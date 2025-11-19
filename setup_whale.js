// setup_whale.js
import { pool } from './src/db.js';

const createTableQuery = `
CREATE TABLE IF NOT EXISTS whale_alerts (
    id SERIAL PRIMARY KEY,
    tx_hash VARCHAR(255) UNIQUE,
    from_address VARCHAR(255),
    to_address VARCHAR(255),
    amount DECIMAL(18, 2),
    amount_usd DECIMAL(18, 2),
    token_symbol VARCHAR(10) DEFAULT 'BNB',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function setup() {
  try {
    console.log('🐋 Balina tablosu oluşturuluyor...');
    await pool.query(createTableQuery);
    console.log('✅ BAŞARILI: "whale_alerts" tablosu hazır.');
  } catch (error) {
    console.error('❌ HATA:', error.message);
  } finally {
    await pool.end();
    process.exit();
  }
}

setup();
