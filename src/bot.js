/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v3.0 (SADECE METİN TESTİ)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID; 

// Not: Maskot URL'leri devre dışıdır.
// const AIRDROP_MASCOT_URL = "..."; 
// const BUY_SELL_MASCOT_URL = "..."; 

let bot;

if (!TOKEN || !CHAT_ID) {
  console.warn(
    "[bot.js] ⚠️ UYARI: TELEGRAM_BOT_TOKEN veya TELEGRAM_CHANNEL_ID ayarlanmamış. Bildirimler devre dışı."
  );
} else {
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log("[bot.js] ✅ Telegram botu bildirimler için hazır.");
}

/**
 * BÖLÜM 1: Airdrop Claim Bildirimi (SADECE METİN)
 * Bu, sendPhoto yerine sendMessage kullanır.
 */
export const sendAirdropClaim = async ({ wallet, amount }) => {
    if (!bot) return;
    const formattedAmount = Number(amount).toLocaleString('en-US');
    const caption = `
        <b>🎁 NEW AIRDROP CLAIM - TEXT ONLY TEST 🎁</b>
        
        💰 <b>Amount:</b> ${formattedAmount} $SKYL
        👤 <b>Wallet:</b> <code>${wallet}</code>
        🔗 <b>BSCScan:</b> <a href="https://bscscan.com/address/${wallet}">View Address</a>
    `;
    try {
        await bot.sendMessage(CHAT_ID, caption, { parse_mode: "HTML" });
        console.log("[bot.js] ✅ Telegram (Airdrop) TEXT notification sent.");
    } catch (error) {
        console.error("[bot.js] ❌ Telegram'a Airdrop TEXT gönderirken hata:", error.message);
    }
};

/**
 * BÖLÜM 2: Alım/Satım Bildirimi (SADECE METİN)
 * Hatanın Maskot URL'sinde olup olmadığını kesin olarak test eder.
 */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return; 

  // Mesaja TxHash linkini ekle
  const finalCaption = `${message}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;

  try {
    // Fotoğraf yerine sadece metin gönderiyoruz
    await bot.sendMessage(CHAT_ID, finalCaption, {
      parse_mode: "HTML",
    });
    console.log("[bot.js] ✅ Telegram (Buy/Sell) TEXT notification sent.");
  } catch (error) {
    // Hata alınırsa, hatanın ne olduğunu loglayalım
    console.error(`[bot.js] ❌ HATA: TEXT bildirim gönderilemedi. Hata: ${error.message}`);
  }
};