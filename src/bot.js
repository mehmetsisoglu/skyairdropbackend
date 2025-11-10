/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v2.1
   (Düzeltilmiş URL'ler)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID; 

// --- MASCOT URL'LERİ (ÇALIŞAN ADRESLERLE GÜNCELLENDİ) ---
const AIRDROP_MASCOT_URL = "https://skyl.online/images/Skyhawk_Airdrop.png";
const BUY_SELL_MASCOT_URL = "https://skyl.online/images/Skyhawk_Buy.png";
// -----------------------------------------------------------------

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
 * BÖLÜM 1: Airdrop Claim Bildirimi (Fotoğraflı)
 */
export const sendAirdropClaim = async ({ wallet, amount }) => {
  if (!bot) return; 

  const formattedAmount = Number(amount).toLocaleString('en-US');
  const caption = `
<b>🎁 YENİ AIRDROP CLAIM! 🎁</b>

Bir kullanıcı airdrop'unu başarıyla talep etti!

💰 <b>Miktar:</b> ${formattedAmount} $SKYL
👤 <b>Cüzdan:</b> <code>${wallet}</code>
🔗 <b>BSCScan:</b> <a href="https://bscscan.com/address/${wallet}">Adresi Görüntüle</a>
  `;

  try {
    await bot.sendPhoto(CHAT_ID, AIRDROP_MASCOT_URL, {
      caption: caption,
      parse_mode: "HTML",
    });
    console.log("[bot.js] ✅ Telegram (Airdrop) bildirimi gönderildi.");
  } catch (error) {
    console.error("[bot.js] ❌ Telegram'a Airdrop fotoğrafı gönderirken hata:", error.message);
  }
};

/**
* BÖLÜM 2: Alım/Satım Bildirimi (Fotoğraflı)
 * Mesajı Markdown formatında alır ve İngilizce olarak gönderir.
 */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return; 

  // Botun göndereceği altyazı (tamamen İngilizce)
  const finalCaption = `${message}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;

  try {
    await bot.sendPhoto(CHAT_ID, BUY_SELL_MASCOT_URL, {
      caption: finalCaption,
      parse_mode: "HTML",
    });
    console.log("[bot.js] ✅ Telegram (Buy/Sell) notification sent (EN).");
  } catch (error) {
    console.error("[bot.js] ❌ Telegram (Buy/Sell) notification error:", error.message);
  }
};
