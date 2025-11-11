/* ==============================================
   Skyline Logic ($SKYL) - PancakeSwap "Buy Bot" v7.5 (EXPORT DÜZELTİLDİ)
   ============================================== */

import { ethers } from "ethers";
import dotenv from "dotenv";
import { sendBuyDetected } from "./bot.js"; 

dotenv.config();

// --- Kontrat Adresleri ve ABI'lar ---
const WSS_URL = process.env.BSC_WSS_URL; 
const PAIR_ADDRESS = process.env.PANCAKESWAP_PAIR_ADDRESS; 
const SKYL_ADDRESS = "0xa7c4436c2Cf6007Dd03c3067697553bd51562f2c";
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; 

const PAIR_ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)"
];

const TOKEN_ABI = [
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

// --- GÜVENLİK FİLTRESİ ---
const sanitizeHTML = (input = "") =>
  input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&/g, "&amp;");
// ----------------------------

// --- Yardımcı Fonksiyonlar ---
function formatBigInt(amount, decimals) {
  return parseFloat(ethers.formatUnits(amount, decimals)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
}

// === Ana Bot Mantığı ===
async function startBot() {
  console.log("[buy-bot.js] 🤖 Skyline Logic Buy Bot başlatılıyor...");

  // ... (Bot başlatma ve bağlantı kodları aynı kalır)

  // "Swap" (Takas) olayını dinlemeye başla
  pairContract.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
    try {
      let bnbAmount, skylAmount, message, txHash;
      
      // ... (Hesaplama kodları aynı kalır)
      
      // Biri $SKYL ALDIĞINDA
      if (bnbAmountIn > 0n && skylAmountOut > 0n) {
        // ... (Mesaj içeriği aynı kalır)
      }
      // Biri $SKYL SATTIĞINDA
      else if (skylAmountIn > 0n && bnbAmountOut > 0n) {
        // ... (Mesaj içeriği aynı kalır)
      }

      // Mesaj varsa Telegram'a gönder
      if (message) {
        await sendBuyDetected(message, txHash);
      }
    
    } catch (e) {
      console.error(`[buy-bot.js] Swap olayı işlenirken kritik hata: ${e.message}`);
    }
  });

  // Bağlantı hatalarını yakala ve yeniden bağlanmayı dene
  provider.on('error', (err) => {
    console.error(`[buy-bot.js] WebSocket Bağlantı Hatası: ${err.message}`);
    console.log('[buy-bot.js] 5 saniye içinde yeniden bağlanmaya çalışılıyor...');
    setTimeout(startBot, 5000); 
  });

  console.log("[buy-bot.js] ✅ Bot, PancakeSwap 'Swap' olaylarını dinlemeye başladı.");
}

// Botu başlat
startBot();