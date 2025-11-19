import { ethers } from 'ethers';
import { pool } from '../db.js';
import 'dotenv/config';

// WBNB Kontrat Adresi (BSC Ağı)
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const WBNB_ABI = ["event Transfer(address indexed from, address indexed to, uint value)"];

// Eşik Değer: 10 BNB ve üzeri (Yaklaşık $6,000+)
const WHALE_THRESHOLD = 10.0; 
let isWatching = false;

export async function startWhaleWatcher() {
  if (isWatching) return;
  
  // Public WSS (Websocket) Adresi - BSC için
  const providerUrl = "wss://bsc-rpc.publicnode.com"; 
  
  console.log("🐋 Balina Avcısı Başlatılıyor...");
  
  try {
    const provider = new ethers.WebSocketProvider(providerUrl);
    const contract = new ethers.Contract(WBNB_ADDRESS, WBNB_ABI, provider);

    isWatching = true;

    // Transfer olayını dinle
    contract.on("Transfer", async (from, to, value, event) => {
      try {
        const amountBNB = parseFloat(ethers.formatEther(value));

        // Sadece büyük balıkları yakala
        if (amountBNB >= WHALE_THRESHOLD) {
          const txHash = event.log.transactionHash;
          const estUsd = amountBNB * 620; // Tahmini BNB fiyatı ($620)

          console.log(`🐋 WHALE ALERT: ${amountBNB.toFixed(2)} BNB yakalandı!`);

          // Veritabanına kaydet
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

    console.log(`✅ Balina Avcısı Aktif (Eşik: ${WHALE_THRESHOLD} BNB)`);

    // Bağlantı koparsa yeniden bağlan
    provider.websocket.on("close", () => {
        console.log("⚠️ WSS Koptu, yeniden bağlanılıyor...");
        isWatching = false;
        setTimeout(startWhaleWatcher, 5000);
    });

  } catch (error) {
    console.error("❌ Balina Servisi Başlatılamadı:", error.message);
    isWatching = false;
    // 10 saniye sonra tekrar dene
    setTimeout(startWhaleWatcher, 10000);
  }
}
