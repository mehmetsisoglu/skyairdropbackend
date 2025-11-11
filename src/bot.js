/* ==============================================
   Skyline Logic ($SKYL) - PancakeSwap "Buy Bot" v7.4 (FINAL HATA AYIKLAMA)
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

// --- GÜVENLİK FİLTRESİ (Metindeki özel karakterleri temizler) ---
const sanitizeHTML = (input = "") =>
  input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&/g, "&amp;");
// -----------------------------------------------------------------

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

  if (!WSS_URL || !PAIR_ADDRESS) {
    console.error("[buy-bot.js] ❌ HATA: BSC_WSS_URL veya PANCAKESWAP_PAIR_ADDRESS ortam değişkenleri ayarlanmamış. Bot durduruluyor.");
    return;
  }

  // WebSocket sağlayıcısı ile BNB Chain'e bağlan
  const provider = new ethers.WebSocketProvider(WSS_URL);
  const pairContract = new ethers.Contract(PAIR_ADDRESS, PAIR_ABI, provider);

  // Token bilgilerini (decimals, symbol) al
  let token0Address, token1Address;
  try {
    [token0Address, token1Address] = await Promise.all([
      pairContract.token0(),
      pairContract.token1()
    ]);
  } catch (e) {
    console.error("[buy-bot.js] ❌ Kontrat token'ları okunurken hata oluştu:", e.message);
    return;
  }
  
  const token0Contract = new ethers.Contract(token0Address, TOKEN_ABI, provider);
  const token1Contract = new ethers.Contract(token1Address, TOKEN_ABI, provider);

  const [token0, token1] = await Promise.all([
    { address: token0Address, decimals: await token0Contract.decimals(), symbol: await token0Contract.symbol() },
    { address: token1Address, decimals: await token1Contract.decimals(), symbol: await token1Contract.symbol() }
  ]);

  console.log(`[buy-bot.js] ✅ ${token0.symbol}/${token1.symbol} paritesi dinleniyor...`);

  // "Swap" (Takas) olayını dinlemeye başla
  pairContract.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
    try {
      let bnbAmount, skylAmount, message, txHash;
      
      // İşlem (tx) hash'ini almanın güvenilir yolu
      txHash = event && event.log ? event.log.transactionHash : "Unknown"; 

      const skylToken = (token0.address.toLowerCase() === SKYL_ADDRESS.toLowerCase()) ? token0 : token1;
      const bnbToken = (token0.address.toLowerCase() === WBNB_ADDRESS.toLowerCase()) ? token0 : token1;

      // Gelen/Giden miktarları doğru token'a ata
      const skylAmountIn = (skylToken === token0) ? amount0In : amount1In;
      const skylAmountOut = (skylToken === token0) ? amount0Out : amount1Out;
      const bnbAmountIn = (bnbToken === token0) ? amount0In : amount1In;
      const bnbAmountOut = (bnbToken === token0) ? amount0Out : amount1Out;

      // Biri $SKYL ALDIĞINDA (BNB Girdi, SKYL Çıktı)
      if (bnbAmountIn > 0n && skylAmountOut > 0n) {
        bnbAmount = formatBigInt(bnbAmountIn, bnbToken.decimals);
        skylAmount = formatBigInt(skylAmountOut, skylToken.decimals);
        
        // Sanitize uygulanmış değerleri metne ekle
        message = `
🟢🟢🟢 <b>New $SKYL Buy Detected!</b> 🟢🟢🟢

📈 <b>Amount Bought:</b> ${sanitizeHTML(skylAmount)} $SKYL
💰 <b>Spent:</b> ${sanitizeHTML(bnbAmount)} BNB
👤 <b>Buyer:</b> <code>${to.slice(0, 6)}...${to.slice(-4)}</code>
        `;
      }
      // Biri $SKYL SATTIĞINDA (SKYL Girdi, BNB Çıktı)
      else if (skylAmountIn > 0n && bnbAmountOut > 0n) {
        skylAmount = formatBigInt(skylAmountIn, skylToken.decimals);
        bnbAmount = formatBigInt(bnbAmountOut, bnbToken.decimals);
        
        // Sanitize uygulanmış değerleri metne ekle
        message = `
🔴🔴🔴 <b>$SKYL Sell Detected!</b> 🔴🔴🔴

📉 <b>Amount Sold:</b> ${sanitizeHTML(skylAmount)} $SKYL
💸 <b>Received:</b> ${sanitizeHTML(bnbAmount)} BNB
👤 <b>Seller:</b> <code>${to.slice(0, 6)}...${to.slice(-4)}</code>
        `;
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