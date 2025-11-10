/* ==============================================
   Skyline Logic - Telegram Bildirim Motoru v7.2
   (STABLE + FLOOD PROTECTION + RETRY + QUEUE)
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
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log("[bot.js] ✅ Telegram botu bildirimler için hazır.");

  // Kanal ID geçerlilik kontrolü
  if (!CHAT_ID.startsWith("-100")) {
    console.warn("[bot.js] ⚠️ WARNING: TELEGRAM_CHANNEL_ID kanal formatında olmayabilir (-100...).");
  }
}

/* ============================================================
   GÜVENLİK: HTML Injection koruması
   (Sadece message değişkenine uygulanır)
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
   BÖLÜM 1: Airdrop Claim Bildirimi (Aynı kaldı)
============================================================ */
export const sendAirdropClaim = async ({ wallet, amount }) => {
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
   BÖLÜM 2: Buy/Sell Bildirimi (Geliştirilmiş v7.2)
============================================================ */
export const sendBuyDetected = async (message, txHash) => {
  if (!bot) return;

  // Güvenlik filtresi (sadece message)
  const safeMessage = sanitizeHTML(message);

  const finalCaption = `${safeMessage}\n\n🔗 <a href="https://bscscan.com/tx/${txHash}">View Transaction on BscScan</a>`;

  try {
    // 1) Ana mesaj kuyruğa alınır + retry uygulanır
    await pushToQueue(() =>
      sendWithRetry(() =>
        bot.sendMessage(CHAT_ID, finalCaption, { parse_mode: "HTML" })
      )
    );

    console.log("[bot.js] ✅ Telegram (Buy/Sell) TEXT notification sent.");

    // 2) Test mesajı (Hata zorlama mekanizması)
    setTimeout(async () => {
      try {
        await pushToQueue(() =>
          sendWithRetry(() =>
            bot.sendMessage(
              CHAT_ID,
              "⚠️ Mesajın ulaştığından emin olmak için bu satır test amaçlı gönderilmiştir.",
              { parse_mode: "HTML", disable_notification: true }
            )
          )
        );
      } catch (e) {
        console.error(`[bot.js] 🚨 KRİTİK HATA: İkinci mesaj gönderilemedi: ${e.message}`);
      }
    }, 1200);

  } catch (err) {
    console.error(`[bot.js] ❌ HATA: Ana bildirim gönderilemedi → ${err.message}`);
  }
};