/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v7.0 (FINAL STABLE TEXT)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID; 

let bot;

if (!TOKEN || !CHAT_ID) {
  console.warn(
    "[bot.js] ⚠️ WARNING: TELEGRAM_BOT_TOKEN or CHANNEL_ID not set. Notifications disabled."
  );
} else {
  // CRITICAL FIX: Botu sadece mesaj göndermek için başlat. 
  // Polling kapalı olduğu için 409 Conflict hatası çözülür.
  bot = new TelegramBot(TOKEN, { polling: false }); 
  console.log("[bot.js] ✅ Telegram bot is running (Passive Mode).");
}

/**
 * BÖLÜM 1: Airdrop Claim Bildirimi (SADECE METİN)
 * server.js tarafından çağrılır.
 */
export const sendAirdropClaim = async ({ wallet, amount }) => { 
    if (!bot) return;

    const formattedAmount = Number(amount).toLocaleString('en-US');
    const caption = `
        <b>🎁 NEW AIRDROP CLAIM 🎁</b>
        
        💰 <b>Amount:</b> ${formattedAmount} $SKYL
        👤 <b>Wallet:</b> <code>${wallet}</code>
        🔗 <b>BSCScan:</b> <a href="https://bscscan.com/address/${wallet}">View Address</a>
    `;
    try {
        // Metin mesajı gönderiliyor
        await bot.sendMessage(CHAT_ID, caption, { parse_mode: "HTML" });
        console.log("[bot.js] ✅ Telegram (Airdrop) TEXT notification sent.");
    } catch (error) {
        console.error("[bot.js] ❌ Telegram'a Airdrop TEXT gönderirken hata:", error.message);
    }
};

/**
 * BÖLÜM 2: Alım/Satım Bildirimi (SADECE METİN)
 * buy-bot.js tarafından çağrılır.
 */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return; 

  // Final metin (message zaten İngilizce, HTML formatındadır)
  const finalCaption = `${message}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;

  try {
    // Metin mesajı gönderiliyor
    await bot.sendMessage(CHAT_ID, finalCaption, {
      parse_mode: "HTML",
    });
    console.log("[bot.js] ✅ Telegram (Buy/Sell) TEXT notification sent.");
  } catch (error) {
    console.error(`[bot.js] ❌ HATA: TEXT bildirim gönderilemedi. Hata: ${error.message}`);
  }
};