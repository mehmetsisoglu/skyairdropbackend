import { ethers } from 'ethers';
import { pool } from '../db.js';
import 'dotenv/config';

// WBNB Kontrat Adresi (BSC)
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const WBNB_ABI = ["event Transfer(address indexed from, address indexed to, uint value)"];

// Balina Eşiği: 10 BNB
const WHALE_THRESHOLD = 10.0; 
let isWatching = false;

// 1. OTOMATİK TABLO KURULUMU
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
    console.log('✅ [Database] Balina tablosu kontrol edildi/hazır.');
  } catch (err) {
    console.error('❌ [Database] Tablo oluşturma hatası:', err.message);
  }
}

// 2. BALINA AVCISI
export async function startWhaleWatcher() {
  if (isWatching) return;

  // Önce tabloyu garantiye al
  await ensureWhaleTableExists();
  
  // Public BSC Node (Websocket)
  const providerUrl = "wss://bsc-rpc.publicnode.com"; 
  
  console.log("🐋 Balina Avcısı Başlatılıyor...");
  
  try {
    const provider = new ethers.WebSocketProvider(providerUrl);
    const contract = new ethers.Contract(WBNB_ADDRESS, WBNB_ABI, provider);

    isWatching = true;

    contract.on("Transfer", async (from, to, value, event) => {
      try {
        const amountBNB = parseFloat(ethers.formatEther(value));

        // Eşik kontrolü
        if (amountBNB >= WHALE_THRESHOLD) {
          const txHash = event.log.transactionHash;
          const estUsd = amountBNB * 620; // Sabit kur (ileride API bağlanabilir)

          console.log(`🐋 WHALE ALERT: ${amountBNB.toFixed(2)} BNB`);

          // DB Kayıt
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

    console.log(`✅ Balina Takibi Aktif (Limit: ${WHALE_THRESHOLD} BNB)`);

    // Bağlantı koparsa
    provider.websocket.on("close", () => {
        console.log("⚠️ WSS Bağlantısı koptu, tekrar bağlanılıyor...");
        isWatching = false;
        setTimeout(startWhaleWatcher, 5000);
    });

  } catch (error) {
    console.error("❌ Balina Servisi Hatası:", error.message);
    isWatching = false;
    setTimeout(startWhaleWatcher, 10000);
  }
}
