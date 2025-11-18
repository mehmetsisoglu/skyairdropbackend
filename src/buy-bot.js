// src/buy-bot.js (v9.0 – CONFLICT FIX EDITION)
import { ethers } from "ethers";
import dotenv from "dotenv";
// startTelegramBot fonksiyonunu bot.js'den alıyoruz
import { sendBuyDetected, startTelegramBot } from "./bot.js"; 

dotenv.config();

// === ÇEVRE DEĞİŞKENLERİ ===
const WSS = process.env.BSC_WSS_URL;
const PAIR = process.env.PANCAKESWAP_PAIR_ADDRESS;

if (!WSS || !PAIR) {
  console.error("[buy-bot.js] BSC_WSS_URL veya PANCAKESWAP_PAIR_ADDRESS eksik!");
  process.exit(1);
}

// === ABI ===
const ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
];

// === DEĞİŞKENLER ===
let provider, pair;
let retries = 0;
const MAX_RETRIES = 5;

// === ANA FONKSİYON (WSS Listener) ===
const start = () => {
  console.log("[buy-bot.js] Alchemy WSS ile bağlanıyor...");
  
  try {
      provider = new ethers.WebSocketProvider(WSS);
      pair = new ethers.Contract(PAIR, ABI, provider);
    
      pair.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
        const txHash = event.log.transactionHash;
    
        // SKYL = token0, WBNB = token1 (Standart V2 Pair varsayımı)
        // SADECE BUY: WBNB (In) > 0 ve SKYL (Out) > 0
        if (amount1In > 0n && amount0Out > 0n) {
          const skylAmount = ethers.formatUnits(amount0Out, 18);
          const wbnbCost = ethers.formatUnits(amount1In, 18);
    
          // Telegram Bildirimi
          await sendBuyDetected(skylAmount, wbnbCost, to, txHash).catch(err =>
            console.error("[buy-bot.js] Telegram hatası:", err.message)
          );
        }
      });
    
      console.log("[buy-bot.js] Dinleme Başladı (Buy Detected Active).");
      retries = 0;

  } catch (error) {
      console.error("[buy-bot.js] Bağlantı hatası:", error);
      reconnect();
  }
};

// === YENİDEN BAĞLANMA ===
const reconnect = () => {
  if (retries >= MAX_RETRIES) {
    console.error("[buy-bot.js] Çok fazla hata. Çıkış yapılıyor.");
    process.exit(1);
  }
  retries++;
  console.log(`[buy-bot.js] Yeniden bağlanılıyor... (${retries}/${MAX_RETRIES})`);
  setTimeout(start, 5000);
};

if (provider) {
    provider.on("error", reconnect);
    provider.on("close", reconnect);
}

// === SİSTEMİ BAŞLAT ===

// 1. Önce Telegram Botunu Başlat (Polling'i açar)
console.log("[buy-bot.js] Telegram Botu başlatılıyor...");
startTelegramBot(); 

// 2. Sonra Blockchain Dinleyiciyi Başlat
start();

// === KAPATMA ===
process.on("SIGINT", () => {
  console.log("[buy-bot.js] Kapatılıyor...");
  if (provider) provider.destroy();
  process.exit(0);
});
