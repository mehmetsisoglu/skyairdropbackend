/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v6.1 (FULL FEATURED)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID; 

// --- MASCOT URL'LERİ (Lütfen final URL'leri kontrol edin) ---
const AIRDROP_MASCOT_URL = "https://skyl.online/images/Skyhawk_Airdrop.png";
const BUY_SELL_MASCOT_URL = "https://skyl.online/images/Skyhawk_Buy.png";
// --- KRİTİK LİNKLER ---
const PINKSALE_LOCK_URL = "https://www.pinksale.finance/pinklock/bsc/record/1361102"; // PinkSale lock linki
const AIRDROP_CLAIM_URL = "https://skyl.online/airdrop"; 


let bot;

if (!TOKEN || !CHAT_ID) {
  console.warn(
    "[bot.js] ⚠️ WARNING: TELEGRAM_BOT_TOKEN or CHANNEL_ID not set. Notifications disabled."
  );
} else {
  // Botu hem mesaj göndermek hem de yeni üye olaylarını dinlemek için başlat
  bot = new TelegramBot(TOKEN, { polling: true }); 
  console.log("[bot.js] ✅ Telegram bot is running and listening.");
}

/* -------------------------------------------------------------
 * CORE FUNCTIONS (EXPORTED)
 * -------------------------------------------------------------
 */

/**
 * BÖLÜM 1: Airdrop Claim Bildirimi (SADECE METİN)
 */
export const sendAirdropClaim = async ({ wallet, amount }) => { 
    if (!bot) return;

    const formattedAmount = Number(amount).toLocaleString('en-US');
    const caption = `
        <b>🎁 NEW AIRDROP CLAIM DETECTED! 🎁</b>
        
        💰 <b>Amount:</b> ${formattedAmount} $SKYL
        👤 <b>Wallet:</b> <code>${wallet}</code>
        🔗 <b>BSCScan:</b> <a href="https://bscscan.com/address/${wallet}">View Address</a>
    `;
    try {
        await bot.sendMessage(CHAT_ID, caption, { parse_mode: "HTML" });
        console.log("[bot.js] ✅ Telegram (Airdrop) notification sent.");
    } catch (error) {
        console.error("[bot.js] ❌ Telegram Airdrop notification error:", error.message);
    }
};

/**
 * BÖLÜM 2: Alım/Satım Bildirimi (SADECE METİN)
 * Buy-bot.js'ten gelen veriyi alır ve kanal ID'sine gönderir.
 */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return; 

  // Mesaja TxHash linkini ekle (message zaten İngilizce, HTML formatındadır)
  const finalCaption = `${message}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;

  try {
    // Görsel göndermek yerine sadece metin gönderiyoruz (Çökme sorununu kalıcı çözmek için)
    await bot.sendMessage(CHAT_ID, finalCaption, {
      parse_mode: "HTML",
    });
    console.log("[bot.js] ✅ Telegram (Buy/Sell) TEXT notification sent.");
  } catch (error) {
    console.error(`[bot.js] ❌ ERROR: Buy/Sell text notification failed. Error: ${error.message}`);
  }
};


/* -------------------------------------------------------------
 * WELCOME BOT FEATURE (NEW MEMBER LISTENER)
 * -------------------------------------------------------------
 */

// Bu fonksiyon, yeni üye katıldığında çalışır
bot.on('new_chat_members', (msg) => {
    // Sadece hedef kanalımızdan gelen mesajları işlediğimizden emin ol
    // (Bireysel sohbetleri hariç tutmak için)
    if (msg.chat.id.toString() !== CHAT_ID.toString()) return; 

    const newMembers = msg.new_chat_members;

    newMembers.forEach(member => {
        // Eğer katılan kişi bot değilse ve botun kendisi değilse
        if (!member.is_bot) {
            
            // Kullanıcıyı direkt mention'layarak kişiselleştirilmiş hoş geldin mesajı
            const mention = `<a href="tg://user?id=${member.id}">${member.first_name || 'New Member'}</a>`;
            
            const welcomeMessage = `
👋 **WELCOME TO SKYLINE LOGIC, ${member.first_name || 'New Member'}!**

We are thrilled to have you join the Precision Intelligence Layer.

Your first mission is ready:
💎 **Complete the Airdrop** to claim your FREE $SKYL tokens.
✅ **0% Buy/Sell Tax** - We support our holders!

➡️ **START AIRDROP HERE:** <a href="${AIRDROP_CLAIM_URL}">Claim Your SKYL</a>
🔒 **5-Year LP Lock Proof:** <a href="${PINKSALE_LOCK_URL}">View Security Audit</a>
`;

            bot.sendMessage(CHAT_ID, welcomeMessage, {
                parse_mode: 'HTML', // Markdown yerine HTML kullandık
                disable_web_page_preview: false // Linklerin önizlemesini göster
            });
        }
    });
});