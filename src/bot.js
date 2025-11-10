/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v2
   (Fotoğraf gönderme özelliği eklendi)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID; // Bu değişken adını doğrulamıştık

// --- MASCOT URL'LERİ (Lütfen bunları kendi URL'lerinizle değiştirin) ---
// Not: Bu URL'ler, resimlerinizi yüklediğiniz yerin tam adresi olmalıdır.
const AIRDROP_MASCOT_URL = "https://skyl.online/img/Skyhawk_Mascot_DarkMode_MidContrast.jpg";
const BUY_SELL_MASCOT_URL = "https://skyl.online/img/Skyhawk_Mascot_DarkMode_MidContrast.jpg";
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
 * server.js tarafından çağrılır
 */
export const sendAirdropClaim = async ({ wallet, amount }) => {
  if (!bot) return; // Bot başlatılamadıysa çık

  const formattedAmount = Number(amount).toLocaleString('en-US');
  // Not: Markdown v2 formatı özel karakterlerde hata verebilir, HTML daha güvenlidir.
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
 * buy-bot.js tarafından çağrılır (Bu fonksiyon eksikti)
 */
export const sendBuyDetected = async (message) => {
  if (!bot) return; // Bot başlatılamadıysa çık

  try {
    await bot.sendPhoto(CHAT_ID, BUY_SELL_MASCOT_URL, {
      caption: message,
      parse_mode: "HTML", // buy-bot.js HTML formatında gönderecek şekilde ayarlandı
    });
    console.log("[bot.js] ✅ Telegram (Buy/Sell) bildirimi gönderildi.");
  } catch (error) {
    console.error("[bot.js] ❌ Telegram'a Alım/Satım fotoğrafı gönderirken hata:", error.message);
  }
};
