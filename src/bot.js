/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v2
   (Fotoğraf gönderme özelliği eklendi)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID; // Bu değişken adını doğruladık

// --- MASCOT URL'LERİ (Lütfen bunları kendi URL'lerinizle değiştirin) ---
const AIRDROP_MASCOT_URL = "https://skyl.online/img/mascot-airdrop.png";
const BUY_SELL_MASCOT_URL = "https://skyl.online/img/mascot-buy.png";
// -----------------------------------------------------------------

let bot;

if (!TOKEN || !CHAT_ID) {
  console.warn(
    "⚠️ UYARI: TELEGRAM_BOT_TOKEN veya TELEGRAM_CHANNEL_ID ayarlanmamış. Telegram bildirimleri devre dışı."
  );
} else {
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log("✅ Telegram botu bildirimler için hazır.");
}

/**
 * BÖLÜM 1: Airdrop Claim Bildirimi (Fotoğraflı)
 * server.js tarafından çağrılır
 */
export const sendAirdropClaim = async ({ wallet, amount }) => {
  if (!bot) return; // Bot başlatılamadıysa çık

  const formattedAmount = Number(amount).toLocaleString('en-US');
  const caption = `
🎁 **YENİ AIRDROP CLAIM!** 🎁

Bir kullanıcı airdrop'unu başarıyla talep etti!

💰 **Miktar:** ${formattedAmount} $SKYL
👤 **Cüzdan:** \`${wallet}\`
🔗 **BSCScan:** [Adresi Görüntüle](https://bscscan.com/address/${wallet})
  `;

  try {
    await bot.sendPhoto(CHAT_ID, AIRDROP_MASCOT_URL, {
      caption: caption,
      parse_mode: "Markdown",
    });
    console.log("✅ Telegram (Airdrop) bildirimi gönderildi.");
  } catch (error) {
    console.error("❌ Telegram'a Airdrop fotoğrafı gönderirken hata:", error.message);
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
      parse_mode: "Markdown",
    });
    console.log("✅ Telegram (Buy/Sell) bildirimi gönderildi.");
  } catch (error) {
    console.error("❌ Telegram'a Alım/Satım fotoğrafı gönderirken hata:", error.message);
  }
};
