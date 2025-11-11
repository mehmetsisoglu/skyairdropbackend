// src/buy-bot.js (v5.2 – ALCHEMY WSS + STABLE)
import { ethers } from "ethers";
import dotenv from "dotenv";
import { sendBuyDetected } from "./bot.js";

dotenv.config();

const WSS = process.env.BSC_WSS_URL;
const PAIR = process.env.PANCAKESWAP_PAIR_ADDRESS;

if (!WSS || !PAIR) {
  console.error("[buy-bot.js] BSC_WSS_URL veya PAIR eksik!");
  process.exit(1);
}

const ABI = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)"
];

let provider, pair;
let retries = 0;
const MAX_RETRIES = 3;

const start = () => {
  console.log("[buy-bot.js] Alchemy WSS ile bağlanıyor...");
  provider = new ethers.WebSocketProvider(WSS);

  pair = new ethers.Contract(PAIR, ABI, provider);

  pair.on("Swap", async (sender, amount0In, amount1In, amount0Out, amount1Out, to, event) => {
    const txHash = event.log.transactionHash;

    // SKYL = token0, WBNB = token1 (senin pair)
    if (amount1In > 0n && amount0Out > 0n) {
      const skyl = ethers.formatUnits(amount0Out, 18);
      const cost = ethers.formatUnits(amount1In, 18);
      const msg = `BUY DETECTED!\n\n<b>Amount:</b> ${parseFloat(skyl).toFixed(0)} $SKYL\n<b>Cost:</b> ${parseFloat(cost).toFixed(6)} WBNB\n<b>Wallet:</b> <code>${to.slice(0,6)}...${to.slice(-4)}</code>`;
      await sendBuyDetected(msg, txHash);
    }
  });

  console.log("[buy-bot.js] Swap dinleme başladı!");
  retries = 0;
};

const reconnect = () => {
  provider?.destroy();
  if (retries >= MAX_RETRIES) {
  console.error("[buy-bot.js] MAX RETRY – Bot durdu.");
    process.exit(1);
  }
  retries++;
  console.log(`[buy-bot.js] Yeniden bağlanma: ${retries}/${MAX_RETRIES} (3sn)`);
  setTimeout(start, 3000);
};

provider?.on("error", reconnect);
provider?.on("close", reconnect);

start();