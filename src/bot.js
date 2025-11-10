/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v6.0 (sendDocument ile Görüntü Çözümü)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Yeni: Görseli indirmek için gerekli

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID; 

// --- MASCOT URL'LERİ (Sizin teyit ettiğiniz çalışan adresler) ---
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

// === Yeni Yardımcı Fonksiyon: Görseli Hafızaya Alır ===
async function getMascotBuffer(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP hata kodu: ${response.status}`);
        }
        // Görseli Buffer olarak döndür (Telegram için uygun format)
        return response.buffer(); 
    } catch (e) {
        console.error(`[bot.js] ❌ Görsel indirme hatası (${url}): ${e.message}`);
        return null;
    }
}


/**
 * BÖLÜM 2: Alım/Satım Bildirimi (sendDocument ile)
 */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return; 

  // Final metin (metin İngilizce olmalıdır)
  const finalCaption = `${message}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;
  
  // Maskotu indirmeyi dene
  const mascotBuffer = await getMascotBuffer(BUY_SELL_MASCOT_URL);

  try {
    if (mascotBuffer) {
        // sendDocument ile görseli dosya olarak gönderiyoruz (Görüntü hatasını atlatmak için)
        await bot.sendDocument(CHAT_ID, mascotBuffer, {
            caption: finalCaption,
            parse_mode: "HTML",
        }, { filename: 'Skyhawk_Buy.png', contentType: 'image/png' });

        console.log("[bot.js] ✅ Telegram (Buy/Sell) GÖRSEL/DOSYA bildirim sent.");
    } else {
        // Eğer Buffer başarısız olursa, sadece metin göndererek botun susmasını önle
        await bot.sendMessage(CHAT_ID, finalCaption, { parse_mode: "HTML" });
        console.log("[bot.js] ✅ Telegram (Buy/Sell) METİN bildirim sent (Görsel hatası nedeniyle).");
    }
  } catch (error) {
    console.error(`[bot.js] ❌ HATA: Final Telegram Bildirimi gönderilemedi. Hata: ${error.message}`);
  }
};

// ... (sendAirdropClaim fonksiyonunu da aynı şekilde sendDocument olarak güncellemeniz gerekir)
// Ancak şimdilik bu test için, sadece sendBuyDetected'ı güncelleyip sorunu çözmeye odaklanalım.
