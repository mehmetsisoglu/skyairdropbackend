/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v5.1 (EXPORT DÜZELTİLDİ)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Görseli indirmek için gerekli

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID; 

// Test için sadece metin (Görsel devre dışı)
const AIRDROP_MASCOT_URL = "https://skyl.online/images/Skyhawk_Airdrop.png";
const BUY_SELL_MASCOT_URL = "https://skyl.online/images/Skyhawk_Buy.png"; 

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
 * **EXPORT KELİMESİ EKLENDİ**
 */
export const sendAirdropClaim = async ({ wallet, amount }) => { // <-- EXPORT BURADA
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
* Görüntü yükleme sorunlarını atlatmak için sadece metin ve URL gönderilir.
 */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return; 

  const BUY_SELL_MASCOT_URL = "https://skyl.online/images/Skyhawk_Buy.png"; // Çalışan URL'iniz
  
  // Mesaja TxHash linkini ekle
  const finalCaption = `${message}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;

  try {
    // Önce görselin URL'sini metin olarak gönderiyoruz. 
    // Telegram, bu URL'yi otomatik olarak bir resim olarak önizleyecektir.
    await bot.sendMessage(CHAT_ID, BUY_SELL_MASCOT_URL, {
        disable_notification: true, // Kullanıcıları rahatsız etmemek için sessiz gönder
        disable_web_page_preview: false, // Önizlemeyi aç
    });
    
    // Ardından asıl metin mesajını gönderiyoruz
    await bot.sendMessage(CHAT_ID, finalCaption, {
      parse_mode: "HTML",
    });
    
    console.log("[bot.js] ✅ Telegram (Buy/Sell) METİN & URL Bildirim sent.");
  } catch (error) {
    console.error(`[bot.js] ❌ HATA: Final Telegram Bildirimi gönderilemedi. Hata: ${error.message}`);
  }
};
