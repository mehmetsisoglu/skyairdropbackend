/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v7.2 (EXPORT HATA DÜZELTİLDİ)
   ============================================== */

import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID;

let bot;

if (!TOKEN || !CHAT_ID) {
  console.warn("[bot.js] ⚠️ WARNING: TELEGRAM_BOT_TOKEN or CHANNEL_ID not set.");
} else {
  // Polling çatışmasını önlemek için polling kapalı.
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log("[bot.js] ✅ Telegram botu bildirimler için hazır.");

  // Kanal ID geçerlilik kontrolü (Sadece bilgilendirme amaçlı)
  if (CHAT_ID.startsWith("15") || CHAT_ID.startsWith("99")) { // Önceki hatalı ID formatları
    console.warn("[bot.js] ⚠️ WARNING: CHANNEL ID is not negative (-100...). Please check if it's the correct Group/Channel ID.");
  }
}

/* ============================================================
   GÜVENLİK: HTML Injection koruması
============================================================ */
const sanitizeHTML = (input = "") =>
  input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&/g, "&amp;");

/* ============================================================
   FLOOD PROTECTION: 1 saniyede 1 mesaj sınırı + Kuyruk sistemi
============================================================ */
let queue = Promise.resolve();
const pushToQueue = (fn) => {
  queue = queue.then(() => new Promise((resolve) => {
    setTimeout(() => resolve(fn()), 1000);
  }));
  return queue;
};

/* ============================================================
   RETRY MEKANİZMASI (Telegram geçici hataları için)
============================================================ */
const sendWithRetry = async (callback, retries = 3) => {
  try {
    return await callback();
  } catch (err) {
    if (retries === 0) throw err;
    console.warn(`[bot.js] ⚠️ Retry triggered. Kalan deneme: ${retries}`);
    await new Promise((r) => setTimeout(r, 1200)); // 1.2 saniye beklet
    return sendWithRetry(callback, retries - 1);
  }
};

/* ============================================================
   BÖLÜM 1: Airdrop Claim Bildirimi 
   **EXPORT KELİMESİ BURAYA EKLENDİ**
============================================================ */
export const sendAirdropClaim = async ({ wallet, amount }) => { // <--- EXPORT BURADA
  if (!bot) return;

  const formattedAmount = Number(amount).toLocaleString("en-US");

  const caption = `
<b>🎁 NEW AIRDROP CLAIM 🎁</b>

💰 <b>Amount:</b> ${formattedAmount} $SKYL
👤 <b>Wallet:</b> <code>${wallet}</code>
🔗 <b>BSCScan:</b> <a href="https://bscscan.com/address/${wallet}">View Address</a>
`;

  try {
    await pushToQueue(() =>
      sendWithRetry(() =>
        bot.sendMessage(CHAT_ID, caption, { parse_mode: "HTML" })
      )
    );
    console.log("[bot.js] ✅ Telegram (Airdrop) TEXT notification sent.");
  } catch (e) {
    console.error("[bot.js] ❌ Airdrop bildirimi gönderilemedi:", e.message);
  }
};

/* ============================================================
   BÖLÜM 2: Buy/Sell Bildirimi
============================================================ */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return;

  const safeMessage = sanitizeHTML(message);

  const finalCaption = `${safeMessage}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;

  try {
    // Kuyruğa alma ve Retry mekanizması
    await pushToQueue(() =>
      sendWithRetry(() =>
        bot.sendMessage(CHAT_ID, finalCaption, { parse_mode: "HTML" })
      )
    );

    console.log("[bot.js] ✅ Telegram (Buy/Sell) TEXT notification sent.");
  } catch (err) {
    console.error(`[bot.js] ❌ HATA: Ana bildirim gönderilemedi → ${err.message}`);
  }
};