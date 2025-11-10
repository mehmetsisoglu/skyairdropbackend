/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v7.1 (FINAL HATA ZORLAMA)
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
  // Polling kapalı, sadece pasif mesaj gönderiyor
  bot = new TelegramBot(TOKEN, { polling: false }); 
  console.log("[bot.js] ✅ Telegram botu bildirimler için hazır.");
}

// ... (sendAirdropClaim fonksiyonu aynı kalır)

/**
 * BÖLÜM 2: Alım/Satım Bildirimi (HATA ZORLAMA TESTİ)
 */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return; 

  const finalCaption = `${message}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;

  try {
    // 1. ADIM: Normal mesajı göndermeyi dene
    await bot.sendMessage(CHAT_ID, finalCaption, {
      parse_mode: "HTML",
    });
    console.log("[bot.js] ✅ Telegram (Buy/Sell) TEXT notification sent.");
    
    // 2. ADIM (Ekstra Kanıt): Eğer ilk mesaj gitmezse, Telegram'ın 
    // bize hatayı bildirmesi için bir saniye sonra basit bir metin daha gönderiyoruz.
    // Bu, önceki işlemdeki sessiz hatayı yakalamaya zorlayabilir.
    setTimeout(async () => {
        try {
            await bot.sendMessage(CHAT_ID, "⚠️ Mesajın ulaştığından emin olmak için bu satır test amaçlı gönderilmiştir. ⚠️", {
                parse_mode: "HTML",
                disable_notification: true // Sessizce gönder
            });
        } catch(e) {
            console.error(`[bot.js] 🚨 KRİTİK HATA: İkinci Mesaj gönderilemedi. Hata: ${e.message}`);
        }
    }, 1000);

  } catch (error) {
    // Bu sefer yakalanan hatayı loga çok güçlü bir şekilde yazdırıyoruz.
    console.error(`[bot.js] ❌ HATA: Ana Bildirim Gönderilemedi. Hata: ${error.message}`);
  }
};