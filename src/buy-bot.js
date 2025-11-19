// src/buy-bot.js (v18.0 – WHALE ALERT + ROBUST CONNECTION)
import { ethers } from "ethers";
import dotenv from "dotenv";
// Bot başlatıcıyı ve bildirim fonksiyonunu alıyoruz
import { sendBuyDetected, startTelegramBot } from "./bot.js"; 

dotenv.config();

// === KONFİGÜRASYON & GÖRSELLER ===
const WSS = process.env.BSC_WSS_URL;
const PAIR = process.env.PANCAKESWAP_PAIR_ADDRESS;

// Alım Büyüklüğüne Göre Görseller (Linkleri kendi sunucuna göre düzenle)
const IMG_NORMAL = "https://skyl.online/images/Skyhawk_Buy.png";   // Standart Alım
const IMG_JET    = "https://skyl.online/images/Skyhawk_Jet.png";    // 0.5 BNB+ (Orta)
const IMG_WHALE  = "https://skyl.online/images/Skyhawk_Whale.png";  // 2.0 BNB+ (Balina)

// Kritik Kontrol
if (!WSS || !PAIR) {
  console.error("[buy-bot.js] ❌ HATA: .env dosyasında BSC_WSS_URL veya PAIR eksik!");
  process.exit(1);
}

// PancakeSwap V2 Pair ABI (Sadece Swap olayını dinliyoruz)
const ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
];

// Değişkenler
let provider;
let pairContract;
let retries = 0;
const MAX_RETRIES = 10; // Bağlantı koparsa kaç kez denesin?

// ====================================================
//           BLOCKCHAIN DİNLEYİCİ (CORE)
// ====================================================
const startBlockchainListener = () => {
  console.log("[buy-bot.js] 🔌 Alchemy WSS ağına bağlanılıyor...");

  try {
      // 1. Provider Tanımla
      provider = new ethers.WebSocketProvider(WSS);
      
      // 2. Kontratı Tanımla
      pairContract = new ethers.Contract(PAIR, ABI, provider);

      // 3. Olayı Dinlemeye Başla
      pairContract.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
        
        // İşlem Hash'ini al
        const txHash = event.log.transactionHash;

        // LOGIC: Standart V2 Pair'de:
        // amount1In > 0 (BNB Girişi) VE amount0Out > 0 (Token Çıkışı) = BUY (Alım)
        // Tam tersi = SELL (Satış) -> Biz sadece BUY ile ilgileniyoruz.
        
        if (amount1In > 0n && amount0Out > 0n) {
            
          // Wei'den okunabilir sayıya çevir (18 decimals varsayımı)
          const tokenAmount = ethers.formatUnits(amount0Out, 18);
          const bnbCost = ethers.formatUnits(amount1In, 18);
          const bnbValue = parseFloat(bnbCost);

          // --- BALİNA MANTIĞI (WHALE LOGIC) ---
          let selectedImage = IMG_NORMAL;
          let logType = "NORMAL";

          if (bnbValue >= 2.0) {
              selectedImage = IMG_WHALE;
              logType = "🐋 WHALE";
          } else if (bnbValue >= 0.5) {
              selectedImage = IMG_JET;
              logType = "✈️ JET";
          }

          console.log(`[buy-bot.js] 🟢 BUY DETECTED [${logType}]: ${bnbValue} BNB`);

          // Telegram'a Gönder (bot.js içindeki fonksiyonu çağırır)
          await sendBuyDetected(tokenAmount, bnbCost, to, txHash, selectedImage).catch(err => {
              console.error("[buy-bot.js] ⚠️ Telegram Gönderim Hatası:", err.message);
          });
        }
      });

      console.log("[buy-bot.js] ✅ Blockchain Dinleyicisi Aktif.");
      retries = 0; // Bağlantı başarılıysa sayacı sıfırla

  } catch (error) {
      console.error("[buy-bot.js] ❌ Bağlantı Hatası:", error.message);
      reconnect();
  }
};

// ====================================================
//           BAĞLANTI KORUMA (RECONNECT)
// ====================================================
const reconnect = () => {
  if (retries >= MAX_RETRIES) {
    console.error("[buy-bot.js] 💀 Kritik Hata: Maksimum deneme sayısına ulaşıldı. Sistem kapanıyor.");
    process.exit(1);
  }

  retries++;
  const waitTime = 5000; // 5 Saniye bekle
  console.log(`[buy-bot.js] 🔄 Yeniden bağlanılıyor... Deneme: ${retries}/${MAX_RETRIES}`);
  
  // Eski provider'ı temizle (Hafıza sızıntısını önler)
  if (provider) {
      try { provider.destroy(); } catch(e){}
  }

  setTimeout(startBlockchainListener, waitTime);
};

// Provider Seviyesi Hata Yakalama
if (provider) {
    provider.on("error", (e) => {
        console.error("[buy-bot.js] WSS Hatası:", e);
        reconnect();
    });
    provider.on("close", () => {
        console.warn("[buy-bot.js] WSS Bağlantısı kesildi.");
        reconnect();
    });
}

// ====================================================
//           SİSTEMİ BAŞLATMA (EXPORT)
// ====================================================
// Bu fonksiyonu 'server.js' çağıracak. Tek yerden yönetim sağlar.
export const startSkylineSystem = async () => {
    console.log("========================================");
    console.log("🚀 SKYLINE LOGIC SİSTEMLERİ BAŞLATILIYOR");
    console.log("========================================");

    // 1. Önce Telegram Botunu Başlat (Polling'i açar)
    // Bunu server.js başlatsın ki çakışma olmasın.
    console.log("[System] 1. Telegram Botu Başlatılıyor...");
    await startTelegramBot(); 

    // 2. Sonra Blockchain Dinleyicisini Başlat
    console.log("[System] 2. BuyBot Dinleyicisi Başlatılıyor...");
    startBlockchainListener();
};

// Graceful Shutdown (Render sunucusu kapanırsa temiz kapat)
process.on("SIGINT", () => {
  console.log("[buy-bot.js] Kapatılıyor...");
  if (provider) provider.destroy();
  process.exit(0);
});
