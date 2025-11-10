/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v6.0 (URL ÖNİZLEMELİ METİN)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
// Bu fonksiyon artık kullanılmıyor ama hata vermemek için fetch'i tutabiliriz:
// import fetch from "node-fetch"; 

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID; 

// --- MASCOT URL'LERİ (Metin içinde URL olarak gönderilecek) ---
const AIRDROP_MASCOT_URL = "https://skyl.online/images/Skyhawk_Airdrop.png";
const BUY_SELL_MASCOT_URL = "https://skyl.online/images/Skyhawk_Buy.png";
// ---------------------------------------------------------------

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
 * BÖLÜM 1: Airdrop Claim Bildirimi (METİN VE URL ÖNİZLEMESİ)
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
    
    // GÖRSEL ÖNİZLEMESİ İÇİN URL'Yİ METİNİN BAŞINA EKLE
    const messageWithURL = `${AIRDROP_MASCOT_URL}\n\n${caption}`;

    try {
        await bot.sendMessage(CHAT_ID, messageWithURL, {
            parse_mode: "HTML",
            disable_web_page_preview: false, // ÖNİZLEMEYİ AÇ
        });
        console.log("[bot.js] ✅ Telegram (Airdrop) notification sent.");
    } catch (error) {
        console.error("[bot.js] ❌ Telegram'a Airdrop metni gönderirken hata:", error.message);
    }
};

/**
 * BÖLÜM 2: Alım/Satım Bildirimi (METİN VE URL ÖNİZLEMESİ)
 */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return; 

  // Final metin (mesaj zaten İngilizce, HTML formatındadır)
  const finalCaption = `${message}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;
  
  // GÖRSEL ÖNİZLEMESİ İÇİN URL'Yİ METİNİN BAŞINA EKLE
  const messageWithURL = `${BUY_SELL_MASCOT_URL}\n\n${finalCaption}`;


  try {
    // Görseli metin olarak gönderiyoruz, Telegram otomatik önizleme yapıyor
    await bot.sendMessage(CHAT_ID, messageWithURL, {
      parse_mode: "HTML",
      disable_web_page_preview: false, // ÖNİZLEMEYİ AÇ
    });
    console.log("[bot.js] ✅ Telegram (Buy/Sell) notification sent.");
  } catch (error) {
    console.error(`[bot.js] ❌ HATA: Buy/Sell metni gönderilemedi. Hata: ${error.message}`);
  }
};
