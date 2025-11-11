// src/buy-bot.js (v8.0 – BUY DETECTED + X POST + SKYHAWK)
import { ethers } from "ethers";
import dotenv from "dotenv";
import { sendBuyDetected } from "./bot.js";
import { postToX } from "./x-poster.js"; // X OTOMASYONU AKTİF

dotenv.config();

// === ÇEVRE DEĞİŞKENLERİ ===
const WSS = process.env.BSC_WSS_URL;
const PAIR = process.env.PANCAKESWAP_PAIR_ADDRESS;
const X_BEARER = process.env.X_BEARER_TOKEN;

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
const MAX_RETRIES = 3;

// === ANA FONKSİYON ===
const start = () => {
  console.log("[buy-bot.js] Alchemy WSS ile bağlanıyor...");
  provider = new ethers.WebSocketProvider(WSS);
  pair = new ethers.Contract(PAIR, ABI, provider);

  pair.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
    const txHash = event.log.transactionHash;

    // SKYL = token0, WBNB = token1
    // SADECE BUY: WBNB giriyor, SKYL çıkıyor
    if (amount1In > 0n && amount0Out > 0n) {
      const skylAmount = ethers.formatUnits(amount0Out, 18);
      const wbnbCost = ethers.formatUnits(amount1In, 18);

      // === 1. TELEGRAM BİLDİRİMİ ===
      await sendBuyDetected(skylAmount, wbnbCost, to, txHash).catch(err =>
        console.error("[buy-bot.js] Telegram hatası:", err.message)
      );

      // === 2. X OTOMASYONU (AKTİF) ===
      if (X_BEARER) {
        await postToX(skylAmount, wbnbCost, to, txHash).catch(err =>
          console.error("[buy-bot.js] X post hatası:", err.message)
        );
      } else {
        console.warn("[buy-bot.js] X_BEARER_TOKEN eksik → X post atılmadı.");
      }
    }
    // SATIŞ: YOK SAYILIYOR (FUD ÖNLEME)
  });

  console.log("[buy-bot.js] BUY DETECTED + X POST aktif! @SkylineLogicAI");
  retries = 0;
};

// === YENİDEN BAĞLANMA ===
const reconnect = () => {
  if (provider) {
    provider.removeAllListeners();
    provider.destroy();
  }

  if (retries >= MAX_RETRIES) {
    console.error("[buy-bot.js] MAX RETRY AŞILDI – Bot durduruluyor.");
    process.exit(1);
  }

  retries++;
  console.log(`[buy-bot.js] Yeniden bağlanma: ${retries}/${MAX_RETRIES} (3sn)`);
  setTimeout(start, 3000);
};

// === HATA YAKALAMA ===
provider?.on("error", reconnect);
provider?.on("close", reconnect);

// === BAŞLAT ===
start();

// === GRACEFUL SHUTDOWN ===
process.on("SIGINT", () => {
  console.log("[buy-bot.js] Kapatılıyor...");
  provider?.destroy();
  process.exit(0);
});