// src/x-poster.js (v7.0 – İZOLE, GÜVENLİ)
import { sendBuyDetected } from "./bot.js";
import dotenv from "dotenv";

dotenv.config();

const X_BEARER = process.env.X_BEARER_TOKEN;

export const postToX = async (amount, cost, wallet, txHash) => {
  if (!X_BEARER) return;

  const short = wallet.slice(0, 6) + "..." + wallet.slice(-4);
  const text = `$SKYL Buy Detected!\n\n${amount} $SKYL\n${cost} WBNB\nWallet: ${short}\n\nhttps://bscscan.com/tx/${txHash}`;

  try {
    await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${X_BEARER}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });
    console.log("[x-poster.js] X'e post atıldı!");
  } catch (e) {
    console.error("[x-poster.js] X hatası:", e.message);
  }
};