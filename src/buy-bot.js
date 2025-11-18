// src/buy-bot.js (v10.0 – DETAYLI SÜRÜM + ÇAKIŞMA DÜZELTMESİ)
import { ethers } from "ethers";
import dotenv from "dotenv";
// Botun çakışma olmadan başlaması için startTelegramBot fonksiyonunu alıyoruz
import { sendBuyDetected, startTelegramBot } from "./bot.js";

// === X OTOMASYONU (ŞİMDİLİK KAPALI) ===
// import { postToX } from "./x-poster.js"; // İleride açmak istersen uncomment yap

dotenv.config();

// === ÇEVRE DEĞİŞKENLERİ KONTROLÜ ===
const WSS = process.env.BSC_WSS_URL;
const PAIR = process.env.PANCAKESWAP_PAIR_ADDRESS;

if (!WSS || !PAIR) {
  console.error("[buy-bot.js] HATA: BSC_WSS_URL veya PANCAKESWAP_PAIR_ADDRESS eksik!");
  process.exit(1);
}

// === ABI TANIMI ===
const ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
];

// === DEĞİŞKENLER ===
let provider, pair;
let retries = 0;
const MAX_RETRIES = 5;

// === ANA DİNLEME FONKSİYONU ===
const start = () => {
  console.log("[buy-bot.js] Alchemy WSS ile bağlantı kuruluyor...");

  try {
      provider = new ethers.WebSocketProvider(WSS);
      pair = new ethers.Contract(PAIR, ABI, provider);

      // Swap Olayını Dinle
      pair.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
        const txHash = event.log.transactionHash;

        // LOGIC:
        // amount1In (WBNB Girişi) > 0 VE amount0Out (SKYL Çıkışı) > 0 ise bu bir BUY işlemidir.
        if (amount1In > 0n && amount0Out > 0n) {
            
          // Değerleri okunabilir formata çevir
          const skylAmount = ethers.formatUnits(amount0Out, 18);
          const wbnbCost = ethers.formatUnits(amount1In, 18);

          // === TELEGRAM BİLDİRİMİ GÖNDER ===
          await sendBuyDetected(skylAmount, wbnbCost, to, txHash).catch(err =>
            console.error("[buy-bot.js] Telegram gönderim hatası:", err.message)
          );

          // === X (TWITTER) POSTU (KAPALI) ===
          /*
          try {
             await postToX(skylAmount, wbnbCost, to, txHash);
             console.log("[buy-bot.js] X postu atıldı.");
          } catch (e) {
             console.error("[buy-bot.js] X post hatası:", e);
          }
          */
        }
      });

      console.log("[buy-bot.js] Blockchain Dinleyicisi Aktif (Sadece BUY).");
      retries = 0; // Bağlantı başarılıysa sayacı sıfırla

  } catch (error) {
      console.error("[buy-bot.js] Başlatma hatası:", error);
      reconnect();
  }
};

// === YENİDEN BAĞLANMA MEKANİZMASI ===
const reconnect = () => {
  if (provider) {
    try {
        provider.removeAllListeners();
        provider.destroy();
    } catch (e) { console.error("Provider kapatma hatası:", e); }
  }

  if (retries >= MAX_RETRIES) {
    console.error("[buy-bot.js] Kritik Hata: Maksimum deneme sayısına ulaşıldı. Çıkış yapılıyor.");
    process.exit(1);
  }

  retries++;
  console.log(`[buy-bot.js] Bağlantı koptu. Yeniden bağlanılıyor... (${retries}/${MAX_RETRIES})`);
  
  // 5 saniye sonra tekrar dene
  setTimeout(start, 5000);
};

// Provider Hata Dinleyicileri
if (provider) {
    provider.on("error", (err) => {
        console.error("[buy-bot.js] WSS Hatası:", err);
        reconnect();
    });
    provider.on("close", () => {
        console.warn("[buy-bot.js] WSS Bağlantısı kapandı.");
        reconnect();
    });
}

// ====================================================
//               SİSTEMİ BAŞLATMA
// ====================================================

// 1. Adım: Telegram Botunu Başlat (Manuel Polling)
// Bu işlem 'server.js' ile çakışmayı (409 Hatasını) önler.
console.log("[buy-bot.js] Telegram Bot servisi başlatılıyor...");
startTelegramBot(); 

// 2. Adım: Blockchain Dinleyicisini Başlat
start();

// === GÜVENLİ KAPATMA (Graceful Shutdown) ===
process.on("SIGINT", () => {
  console.log("[buy-bot.js] İşlem durduruluyor...");
  if (provider) provider.destroy();
  process.exit(0);
});
