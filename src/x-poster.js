// src/x-poster.js (v8.0 – X OTOMASYONU)
import dotenv from "dotenv";
dotenv.config();

const X_BEARER = process.env.X_BEARER_TOKEN;

export const postToX = async (amount, cost, wallet, txHash) => {
  if (!X_BEARER) return;

  const shortWallet = wallet.slice(0, 6) + "..." + wallet.slice(-4);
  const amountStr = parseFloat(amount).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const costStr = parseFloat(cost).toFixed(6);

  const text = `$SKYL Buy Detected!

${amountStr} $SKYL
${costStr} WBNB
Wallet: ${shortWallet}

https://bscscan.com/tx/${txHash}

@SkylineLogicAI`;

  try {
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${X_BEARER}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (res.ok) {
      console.log("[x-poster.js] X'e post atıldı!");
    } else {
      const err = await res.text();
      console.error("[x-poster.js] X API hatası:", err);
    }
  } catch (e) {
    console.error("[x-poster.js] Bağlantı hatası:", e.message);
  }
};