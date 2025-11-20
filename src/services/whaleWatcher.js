// src/services/whaleWatcher.js (WSS PUSH LOGIC)
import { ethers } from 'ethers';
import { pool } from '../db.js';
import 'dotenv/config';

const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const WBNB_ABI = ["event Transfer(address indexed from, address indexed to, uint value)"];
const WHALE_THRESHOLD = 1000.0; 
let isWatching = false;

// 1. OTOMATİK TABLO KURULUMU (Aynen Korundu)
async function ensureWhaleTableExists() {
  const query = `
    CREATE TABLE IF NOT EXISTS whale_alerts (
      id SERIAL PRIMARY KEY, tx_hash VARCHAR(255) UNIQUE, from_address VARCHAR(255), to_address VARCHAR(255),
      amount DECIMAL(18, 2), amount_usd DECIMAL(18, 2), token_symbol VARCHAR(10) DEFAULT 'BNB', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try { await pool.query(query); } catch (err) { console.error('❌ DB Hatası:', err.message); }
}

// 2. WSS AVCI (Artık WSS sunucusunu parametre olarak alıyor)
export async function startWhaleWatcher(wss) {
  if (isWatching) return;
  await ensureWhaleTableExists();
  
  const providerUrl = process.env.BSC_WSS_URL; 
  if (!providerUrl) { console.error("❌ BSC_WSS_URL ENV DEĞİŞKENİ GEREKLİ!"); return; }
  
  console.log("🐋 Balina Avcısı Başlatılıyor (WSS PUSH)...");
  
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

          const alertData = {
              amount: amountBNB,
              amount_usd: estUsd,
              from_address: from,
              to_address: to,
              tx_hash: txHash,
              timestamp: new Date().toISOString()
          };
          
          // 1. DB'ye Kaydet
          await pool.query(
            `INSERT INTO whale_alerts (tx_hash, from_address, to_address, amount, amount_usd)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tx_hash) DO NOTHING`,
            [txHash, from, to, amountBNB, estUsd]
          );

          // 2. FRONEND'E BROADCAST YAP
          wss.clients.forEach(client => {
              if (client.readyState === client.OPEN) {
                  client.send(JSON.stringify({ type: 'WHALE_ALERT', data: alertData }));
              }
          });

          console.log(`🐋 WSS PUSH: ${amountBNB.toFixed(2)} BNB gönderildi.`);
        }
      } catch (err) { console.error("Whale Process Error:", err.message); }
    });

    console.log(`✅ WSS PUSH Aktif (Eşik: ${WHALE_THRESHOLD} BNB)`);
    provider.websocket.on("close", () => {
        console.log("⚠️ WSS Koptu, tekrar bağlanılıyor...");
        isWatching = false;
        setTimeout(() => startWhaleWatcher(wss), 5000); // WSS sunucusunu tekrar geçir
    });

  } catch (error) {
    console.error("❌ Balina Servisi Hatası:", error.message);
    isWatching = false;
    setTimeout(() => startWhaleWatcher(wss), 10000);
  }
}
