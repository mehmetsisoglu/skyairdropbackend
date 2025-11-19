// src/db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const initDB = async () => {
  const client = await pool.connect();
  try {
    // Airdrop Tabloları
    await client.query(`
      CREATE TABLE IF NOT EXISTS airdrop_tasks (
        wallet TEXT PRIMARY KEY,
        tasks TEXT[] DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS airdrop_stats (
        id SERIAL PRIMARY KEY,
        participants INT DEFAULT 0,
        remaining INT DEFAULT 5000
      );
      INSERT INTO airdrop_stats (id, participants, remaining) VALUES (1, 0, 5000) ON CONFLICT (id) DO NOTHING;
    `);

    // YENİ: Rank Sistemi Tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_ranks (
        user_id BIGINT PRIMARY KEY,
        username TEXT,
        xp INT DEFAULT 0,
        level TEXT DEFAULT 'Cadet'
      );
    `);
    
    console.log('✅ Veritabanı ve Tablolar Hazır.');
  } catch (err) {
    console.error('❌ DB Başlatma Hatası:', err.message);
  } finally {
    client.release();
  }
};
