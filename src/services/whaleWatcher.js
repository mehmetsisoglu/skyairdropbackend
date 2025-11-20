// src/services/whaleWatcher.js (Alchemy WSS ve Test Eşiği)
import { ethers } from 'ethers';
import { pool } from '../db.js';
import 'dotenv/config';

// WBNB Kontrat Adresi (BSC)
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const WBNB_ABI = ["event Transfer(address indexed from, address indexed to, uint value)"];

// YENİ EŞİK DEĞERİ: 100 BNB (Hızlı test ve gerçek balina hareketleri için)
const WHALE_THRESHOLD = 100.0; 
let isWatching = false;

export async function startWhaleWatcher() {
  if (isWatching) return;

  await ensureWhaleTableExists();
  
  // KRİTİK: Public node yerine, ENV'deki ALCHEMY URL'i kullanıyoruz (Daha Stabil)
  const providerUrl = process.env.ALCHEMY_WSS_URL; 
  
  if (!providerUrl) {
      console.error("❌ ALCHEMY_WSS_URL ENV DEĞİŞKENİ GEREKLİ!");
      return; 
  }
  
  console.log("🐋 Balina Avcısı Başlatılıyor (Alchemy ile)...");
  
  try {
    const provider = new ethers.WebSocketProvider(providerUrl);
    const contract = new ethers.Contract(WBNB_ADDRESS, WBNB_ABI, provider);

    isWatching = true;

    contract.on("Transfer", async (from, to, value, event) => {
      try {
        const amountBNB = parseFloat(ethers.formatEther(value));

        if (amountBNB >= WHALE_THRESHOLD) {
          const txHash = event.log.transactionHash;
          const estUsd = amountBNB * 620; 

          console.log(`🐋 TEST WHALE ALERT: ${amountBNB.toFixed(2)} BNB yakalandı!`);

          await pool.query(
            `INSERT INTO whale_alerts (tx_hash, from_address, to_address, amount, amount_usd)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (tx_hash) DO NOTHING`,
            [txHash, from, to, amountBNB, estUsd]
          );
        }
      } catch (err) {
        console.error("Whale İşleme Hatası:", err.message);
      }
    });

    console.log(`✅ Balina Takibi Aktif (Eşik: ${WHALE_THRESHOLD} BNB)`);

    // Bağlantı koparsa yeniden bağlan
    provider.websocket.on("close", () => {
        console.log("⚠️ WSS Koptu, Alchemy'e tekrar bağlanılıyor...");
        isWatching = false;
        setTimeout(startWhaleWatcher, 5000);
    });

  } catch (error) {
    console.error("❌ Balina Servisi Başlatılamadı:", error.message);
    isWatching = false;
    setTimeout(startWhaleWatcher, 10000);
  }
}
async function ensureWhaleTableExists() {
  const query = `
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
  try {
    await pool.query(query);
  } catch (err) {
    console.error('❌ [Database] Tablo oluşturma hatası:', err.message);
  }
}
