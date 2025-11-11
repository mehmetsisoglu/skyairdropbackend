/* ==============================================
   Skyline Logic ($SKYL) - PancakeSwap Buy Bot v7.4
================================================ */

import { ethers } from "ethers";
import dotenv from "dotenv";
import { sendBuyDetected } from "./bot.js";

dotenv.config();

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

const sanitizeHTML = (s = "") =>
  s.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;");

function formatBigInt(amount, decimals) {
  return parseFloat(ethers.formatUnits(amount, decimals)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
}

async function startBot() {
  console.log("[buy-bot.js] 🤖 Buy Bot başlatılıyor...");

  if (!WSS_URL || !PAIR_ADDRESS) {
    console.error("[buy-bot.js] ❌ HATA: WSS veya PAIR adresi yok.");
    return;
  }

  const provider = new ethers.WebSocketProvider(WSS_URL);
  const pair = new ethers.Contract(PAIR_ADDRESS, PAIR_ABI, provider);

  let token0Addr, token1Addr;
  try {
    [token0Addr, token1Addr] = await Promise.all([
      pair.token0(),
      pair.token1()
    ]);
  } catch (e) {
    console.error("[buy-bot.js] ❌ Token0/token1 okunamadı:", e.message);
    return;
  }

  const t0 = new ethers.Contract(token0Addr, TOKEN_ABI, provider);
  const t1 = new ethers.Contract(token1Addr, TOKEN_ABI, provider);

  const token0 = {
    address: token0Addr,
    decimals: await t0.decimals(),
    symbol: await t0.symbol()
  };
  const token1 = {
    address: token1Addr,
    decimals: await t1.decimals(),
    symbol: await t1.symbol()
  };

  console.log(`[buy-bot.js] ✅ ${token0.symbol}/${token1.symbol} pair dinleniyor...`);

  pair.on("Swap", async (sender, a0In, a1In, a0Out, a1Out, to, event) => {
    try {
      let message = null;
      const txHash = event?.log?.transactionHash ?? "Unknown";

      const skyl = token0.address.toLowerCase() === SKYL_ADDRESS.toLowerCase() ? token0 : token1;
      const bnb  = token0.address.toLowerCase() === WBNB_ADDRESS.toLowerCase() ? token0 : token1;

      const skylIn  = skyl === token0 ? a0In : a1In;
      const skylOut = skyl === token0 ? a0Out : a1Out;

      const bnbIn   = bnb === token0 ? a0In : a1In;
      const bnbOut  = bnb === token0 ? a0Out : a1Out;

      // BUY
      if (bnbIn > 0n && skylOut > 0n) {
        const bnbVal  = sanitizeHTML(formatBigInt(bnbIn,  bnb.decimals));
        const skylVal = sanitizeHTML(formatBigInt(skylOut, skyl.decimals));

        message = `
🟢🟢🟢 <b>New $SKYL Buy Detected!</b> 🟢🟢🟢

📈 <b>Amount Bought:</b> ${skylVal} $SKYL
💰 <b>Spent:</b> ${bnbVal} BNB
👤 <b>Buyer:</b> <code>${to.slice(0,6)}...${to.slice(-4)}</code>
        `;
      }
      // SELL
      else if (skylIn > 0n && bnbOut > 0n) {
        const skylVal = sanitizeHTML(formatBigInt(skylIn, skyl.decimals));
        const bnbVal  = sanitizeHTML(formatBigInt(bnbOut, bnb.decimals));

        message = `
🔴🔴🔴 <b>$SKYL Sell Detected!</b> 🔴🔴🔴

📉 <b>Amount Sold:</b> ${skylVal} $SKYL
💸 <b>Received:</b> ${bnbVal} BNB
👤 <b>Seller:</b> <code>${to.slice(0,6)}...${to.slice(-4)}</code>
        `;
      }

      if (message) {
        await sendBuyDetected(message, txHash);
      }

    } catch (e) {
      console.error("[buy-bot.js] ❌ Swap işlenirken hata:", e.message);
    }
  });

  provider.on("error", () => {
    console.error("[buy-bot.js] WebSocket Hatası → Reconnect in 5s");
    setTimeout(startBot, 5000);
  });

  console.log("[buy-bot.js] ✅ Dinleme başladı.");
}

startBot();