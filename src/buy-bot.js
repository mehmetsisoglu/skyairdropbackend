// src/buy-bot.js (v6.0 – SKYHAWK FORMAT)
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
const MAX = 3;

const start = () => {
  console.log("[buy-bot.js] Alchemy ile bağlanıyor...");
  provider = new ethers.WebSocketProvider(WSS);
  pair = new ethers.Contract(PAIR, ABI, provider);

  pair.on("Swap", async (sender, a0In, a1In, a0Out, a1Out, to, ev) => {
    const tx = ev.log.transactionHash;

    // SKYL = token0, WBNB = token1
    if (a1In > 0n && a0Out > 0n) {
      const skyl = ethers.formatUnits(a0Out, 18);
      const cost = ethers.formatUnits(a1In, 18);
      await sendBuyDetected(skyl, cost, to, tx);
    }
  });

  console.log("[buy-bot.js] SKYHAWK formatıyla dinleniyor!");
  retries = 0;
};

const reconnect = () => {
  provider?.destroy();
  if (retries >= MAX) {
    console.error("[buy-bot.js] MAX RETRY – Çıkış.");
    process.exit(1);
  }
  retries++;
  console.log(`[buy-bot.js] Yeniden bağlanma: ${retries}/${MAX}`);
  setTimeout(start, 3000);
};

provider?.on("error", reconnect);
provider?.on("close", reconnect);

start();