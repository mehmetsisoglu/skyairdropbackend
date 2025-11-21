// src/buy-bot.js (v19.0 – ALCHEMY TAMAMEN PASİF + ÇÖKME ÖNLENDİ)
import { ethers } from "ethers";
import dotenv from "dotenv";
import { sendBuyDetected } from "./bot.js";

dotenv.config();

const WSS = process.env.BSC_WSS_URL?.trim();
const PAIR = process.env.PANCAKESWAP_PAIR_ADDRESS?.trim();

// ALCHEMY’Yİ TAMAMEN DEVRE DIŞI BIRAK (İstersen sonra açarsın)
const ALCHEMY_DISABLED = true; // <-- BURASI true OLDUĞU SÜRECE HİÇ BAĞLANMAZ

let provider = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 15;

console.log("[buy-bot.js] Alchemy/WSS durumu:", ALCHEMY_DISABLED ? "PASİF (Güvenli mod)" : "Aktif bekleniyor...");

const connectWithRetry = () => {
  if (ALCHEMY_DISABLED) {
    console.log("[buy-bot.js] Whale & Buy dinleyicisi devre dışı bırakıldı (Render/Alchemy limit aşımı önlemi).");
    return;
  }

  if (!WSS || !PAIR) {
    console.error("[buy-bot.js] .env’de BSC_WSS_URL veya PANCAKESWAP_PAIR_ADDRESS eksik!");
    return;
  }

  console.log(`[buy-bot.js] WSS'ye bağlanılıyor... (Deneme: ${reconnectAttempts + 1})`);

  try {
    provider = new ethers.WebSocketProvider(WSS);

    // TÜM HATALARI YAKALA – ASLA ÇÖKME!
    provider._websocket.on("error", (err) => {
      console.error("[buy-bot.js] WebSocket hatası:", err.message || err);
      scheduleReconnect();
    });

    provider._websocket.on("close", (code) => {
      console.warn("[buy-bot.js] WebSocket kapandı. Kod:", code);
      scheduleReconnect();
    });

    const contract = new ethers.Contract(PAIR, [
      "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
    ], provider);

    contract.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
      try {
        if (amount1In > 0n && amount0Out > 0n) {
          const tokenAmount = ethers.formatUnits(amount0Out, 18);
          const bnbCost = ethers.formatUnits(amount1In, 18);
          const bnbValue = parseFloat(bnbCost);

          let image = "https://skyl.online/images/Skyhawk_Buy.png";
          if (bnbValue >= 2.0) image = "https://skyl.online/images/Skyhawk_Whale.png";
          else if (bnbValue >= 0.5) image = "https://skyl.online/images/Skyhawk_Jet.png";

          await sendBuyDetected(tokenAmount, bnbCost, to, event.log.transactionHash, image);
        }
      } catch (err) {
        console.error("[buy-bot.js] Swap işlenirken hata:", err);
      }
    });

    console.log("[buy-bot.js] Blockchain dinleyicisi aktif!");
    reconnectAttempts = 0;

  } catch (err) {
    console.error("[buy-bot.js] Bağlantı kurulamadı:", err.message);
    scheduleReconnect();
  }
};

const scheduleReconnect = () => {
  if (ALCHEMY_DISABLED) return;

  if (reconnectAttempts >= MAX_RECONNECT) {
    console.error("[buy-bot.js] Maksimum yeniden bağlanma denemesi aşıldı. Buy-bot pasife alındı.");
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(5000 * reconnectAttempts, 60000); // 5sn → 60sn
  console.log(`[buy-bot.js] ${delay/1000}s sonra yeniden bağlanılacak...`);

  if (provider) {
    try { provider.destroy(); } catch {}
    provider = null;
  }

  setTimeout(connectWithRetry, delay);
};

// Sistem başlatma (server.js burayı çağırıyor)
export const startSkylineSystem = async () => {
  console.log("========================================");
  console.log("SKYLINE LOGIC SİSTEMLERİ BAŞLATILIYOR");
  console.log("========================================");

  console.log("[System] 1. Telegram Botu Başlatılıyor...");
  // startTelegramBot artık server.js’de çağrılıyor, burada tekrar çağırmıyoruz

  console.log("[System] 2. BuyBot Dinleyicisi Başlatılıyor...");
  connectWithRetry(); // Artık güvenli
};
