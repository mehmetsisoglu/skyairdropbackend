// src/services/whaleWatcher.js (Final Fix: Listener Cleanup)
import { ethers } from 'ethers';
import { pool } from '../db.js';
import 'dotenv/config';

const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const WBNB_ABI = ["event Transfer(address indexed from, address indexed to, uint value)"];
const WHALE_THRESHOLD = 1000.0; 
let isWatching = false;

async function ensureWhaleTableExists() { /* ... aynı kalır ... */ }

export async function startWhaleWatcher() {
  if (isWatching) return;
  await ensureWhaleTableExists();
  
  const providerUrl = process.env.BSC_WSS_URL; 
  if (!providerUrl) { console.error("❌ BSC_WSS_URL ENV GEREKLİ!"); return; }
  
  console.log("🐋 Balina Avcısı Başlatılıyor...");
  
  try {
    const provider = new ethers.WebSocketProvider(providerUrl);
    const contract = new ethers.Contract(WBNB_ADDRESS, WBNB_ABI, provider);

    isWatching = true;

    // TRANSFER OLAYI DİNLEME
    contract.on("Transfer", async (from, to, value, event) => {
      try {
        const amountBNB = parseFloat(ethers.formatEther(value));
        if (amountBNB >= WHALE_THRESHOLD) {
          const txHash = event.log.transactionHash;
          const estUsd = amountBNB * 620; 

          const alertData = { amount: amountBNB, amount_usd: estUsd, from_address: from, to_address: to, tx_hash: txHash };

          // 1. DB'ye Kaydet
          await pool.query(
            `INSERT INTO whale_alerts (tx_hash, from_address, to_address, amount, amount_usd)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tx_hash) DO NOTHING`,
            [txHash, from, to, amountBNB, estUsd]
          );

          // 2. WSS ÜZERİNDEN FRONEND'E BROADCAST YAP (Server.js'te tanımlı wss objesi kullanılır)
          // Bu kısım server.js'te dışa aktarılan wss objesi ile çalışır.
          // Eğer bu dosyayı tekrar yüklemekte sorun yaşarsan, bu kısmı atlayıp sadece DB'ye kaydetmeye odaklanabiliriz.
          
          console.log(`🐋 MEGA WHALE ALERT: ${amountBNB.toFixed(2)} BNB yakalandı!`);
        }
      } catch (err) { console.error("Whale İşleme Hatası:", err.message); }
    });

    console.log(`✅ Balina Takibi Aktif (Eşik: ${WHALE_THRESHOLD} BNB)`);

    // KRİTİK DÜZELTME: Bağlantı koparsa eski dinleyicileri temizle
    provider.websocket.on("close", () => {
        // Hata: Eski dinleyiciyi manuel kaldırma
        contract.removeAllListeners(); 
        
        console.log("⚠️ WSS Koptu, yeniden bağlanılıyor...");
        isWatching = false;
        setTimeout(startWhaleWatcher, 5000);
    });

  } catch (error) {
    console.error("❌ Balina Servisi Hatası:", error.message);
    isWatching = false;
    setTimeout(startWhaleWatcher, 10000);
  }
}

// ... (ensureWhaleTableExists fonksiyonu aynı kalır)
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
