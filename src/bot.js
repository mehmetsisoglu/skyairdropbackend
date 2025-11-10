/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v5.0 (GÖRSEL VE METİN)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID; 

// --- MASCOT URL'LERİ (Sizin teyit ettiğiniz çalışan adresler) ---
// Lütfen bu URL'lerin sunucunuzda (skyl.online/images) erişilebilir olduğundan emin olun.
const AIRDROP_MASCOT_URL = "https://skyl.online/images/Skyhawk_Airdrop.png";
const BUY_SELL_MASCOT_URL = "https://skyl.online/images/Skyhawk_Buy.png"; 
// ---------------------------------------------------------------

let bot;

if (!TOKEN || !CHAT_ID) {
  console.warn(
    "[bot.js] ⚠️ UYARI: TELEGRAM_BOT_TOKEN veya TELEGRAM_CHANNEL_ID ayarlanmamış. Bildirimler devre dışı."
  );
} else {
  // Yönetici izni olduğunu varsayarak botu başlat
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log("[bot.js] ✅ Telegram botu bildirimler için hazır.");
}

/**
 * BÖLÜM 1: Airdrop Claim Bildirimi (GÖRSEL VE METİN)
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
        await bot.sendPhoto(CHAT_ID, AIRDROP_MASCOT_URL, {
            caption: caption,
            parse_mode: "HTML",
        });
        console.log("[bot.js] ✅ Telegram (Airdrop) notification sent.");
    } catch (error) {
        console.error("[bot.js] ❌ Telegram'a Airdrop fotoğrafı gönderirken hata:", error.message);
    }
};

/**
 * BÖLÜM 2: Alım/Satım Bildirimi (GÖRSEL VE METİN)
 */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return; 

  // Mesaja TxHash linkini ekle (message zaten İngilizce, HTML formatındadır)
  const finalCaption = `${message}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;

  try {
    await bot.sendPhoto(CHAT_ID, BUY_SELL_MASCOT_URL, {
      caption: finalCaption,
      parse_mode: "HTML",
    });
    console.log("[bot.js] ✅ Telegram (Buy/Sell) notification sent.");
  } catch (error) {
    console.error(`[bot.js] ❌ HATA: Buy/Sell fotoğrafı gönderilemedi. Hata: ${error.message}`);
  }
};
