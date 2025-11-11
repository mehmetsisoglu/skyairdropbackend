/* src/bot.js */
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const RAW_CHAT_ID = process.env.TELEGRAM_CHANNEL_ID?.trim();

let bot = null;

const getChatId = () => {
  if (!RAW_CHAT_ID) return null;
  if (RAW_CHAT_ID.startsWith("@") || RAW_CHAT_ID.startsWith("-100")) return RAW_CHAT_ID;
  const num = Number(RAW_CHAT_ID);
  return isNaN(num) ? null : num;
};

const CHAT_ID = getChatId();

if (!TOKEN || !CHAT_ID) {
  console.warn("[bot.js] ⚠️ Bot token veya kanal ID eksik. Bildirimler kapalı.");
} else {
  try {
    bot = new TelegramBot(TOKEN, { polling: false });
    console.log("[bot.js] ✅ Telegram botu hazır.");
  } catch (err) {
    console.error("[bot.js] Bot başlatılamadı:", err.message);
  }
}

const escapeHTML = (str) =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// === EXPORT: Airdrop ===
export const sendAirdropClaim = async ({ wallet, amount } = {}) => {
  if (!bot || !CHAT_ID) return;

  const num = parseFloat(amount);
  const formatted = isNaN(num) ? "0" : num.toLocaleString("en-US");
  const safeWallet = escapeHTML(wallet || "unknown");

  const text = `
<b>NEW AIRDROP CLAIM</b>

<b>Amount:</b> ${formatted} $SKYL
<b>Wallet:</b> <code>${safeWallet}</code>
<b>BSCScan:</b> <a href="https://bscscan.com/address/${safeWallet}">View</a>
  `.trim();

  try {
    await bot.sendMessage(CHAT_ID, text, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    console.log("[bot.js] Airdrop bildirimi gönderildi.");
  } catch (err) {
    console.error("[bot.js] Airdrop hatası:", err.message);
  }
};

// === EXPORT: Buy/Sell ===
export const sendBuyDetected = async (message, txHash) => {
  if (!bot || !CHAT_ID) return;

  let text = message || "İşlem tespit edildi.";

  if (txHash && typeof txHash === "string" && txHash.trim()) {
    const safeTx = escapeHTML(txHash.trim());
    text += `\n\n<a href="https://bscscan.com/tx/${safeTx}">View on BscScan</a>`;
  }

  try {
    await bot.sendMessage(CHAT_ID, text.trim(), {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    console.log("[bot.js] Buy/Sell bildirimi gönderildi.");
  } catch (err) {
    console.error("[bot.js] Buy/Sell hatası:", err.message);
  }
};