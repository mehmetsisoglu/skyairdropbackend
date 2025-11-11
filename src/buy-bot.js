// src/buy-bot.js – v4.0 (Typo Fix + Stabil + Gerçek Pair)
import { ethers } from "ethers";
import dotenv from "dotenv";
import { sendBuyDetected } from "./bot.js";

dotenv.config();

const WSS_URL = process.env.BSC_WSS_URL || "wss://bsc.publicnode.com";
const PAIR_ADDRESS = process.env.PANCAKESWAP_PAIR_ADDRESS || "0x56b286e21f585ea76197712dff66837e622e5d21"; // DEFAULT DOĞRU

if (!WSS_URL) {
  console.error("[buy-bot.js] BSC_WSS_URL eksik!");
  process.exit(1);
}

const PAIR_ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)"
];

let provider, pair, isSKYLToken0;
let retry = 0;
const MAX_RETRY = 5;

const start = async () => {
  try {
    console.log("[buy-bot.js] Bağlanıyor:", WSS_URL);
    provider = new ethers.WebSocketProvider(WSS_URL);

    pair = new ethers.Contract(PAIR_ADDRESS, PAIR_ABI, provider);

    const [t0, t1] = await Promise.all([pair.token0(), pair.token1()]);
    isSKYLToken0 = t0.toLowerCase() === "0xa7c4436c2cf6007dd03c3067697553bd51562f2c".toLowerCase();

    console.log(`[buy-bot.js] SKYL/${isSKYLToken0 ? "token0" : "token1"} – Dinleniyor...`);

    pair.on("Swap", async (sender, a0In, a1In, a0Out, a1Out, to, event) => {
      const tx = event.log.transactionHash;

      const skylIn = isSKYLToken0 ? a0In : a1In;
      const skylOut = isSKYLToken0 ? a0Out : a1Out;
      const wbnbIn = isSKYLToken0 ? a1In : a0In;
      const wbnbOut = isSKYLToken0 ? a1Out : a0Out;

      if (wbnbIn > 0n && skylOut > 0n) {
        const amount = parseFloat(ethers.formatUnits(skylOut, 18)).toFixed(2);
        const cost = parseFloat(ethers.formatUnits(wbnbIn, 18)).toFixed(6);
        const msg = `🟢 BUY DETECTED!\n\n<b>Amount:</b> ${amount} $SKYL\n<b>Cost:</b> ${cost} WBNB\n<b>Wallet:</b> <code>${to.slice(0,6)}...${to.slice(-4)}</code>`;
        await sendBuyDetected(msg, tx);
      }

      if (skylIn > 0n && wbnbOut > 0n) {
        const amount = parseFloat(ethers.formatUnits(skylIn, 18)).toFixed(2);
        const received = parseFloat(ethers.formatUnits(wbnbOut, 18)).toFixed(6);
        const msg = `🔴 SELL DETECTED!\n\n<b>Amount:</b> ${amount} $SKYL\n<b>Received:</b> ${received} WBNB\n<b>Wallet:</b> <code>${to.slice(0,6)}...${to.slice(-4)}</code>`;
        await sendBuyDetected(msg, tx);
      }
    });

    // Health
    setInterval(async () => {
      try {
        const res = await pair.getReserves();
        console.log(`[buy-bot.js] Reserves: SKYL ${ethers.formatUnits(res[0], 18)} | WBNB ${ethers.formatUnits(res[1], 18)}`);
      } catch {}
    }, 20000);

    retry = 0;
    console.log("[buy-bot.js] ✅ BOT CANLI – Swap dinleniyor!");
  } catch (err) {
    console.error("[buy-bot.js] Hata:", err.message);
    if (retry < MAX_RETRY) {
      retry++;
      console.log(`[buy-bot.js] Yeniden deneme ${retry}/${MAX_RETRY} (5sn)...`);
      setTimeout(start, 5000);
    } else {
      console.error("[buy-bot.js] MAX RETRY – Kapatılıyor.");
      process.exit(1);
    }
  }
};

start();

process.on("SIGINT", () => provider?.destroy());