// src/bot.js (v9.0 – SKYHAWK + YENİ FORMAT)
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID?.trim();

let bot = null;

if (!TOKEN || !CHAT_ID) {
  console.warn("[bot.js] Token veya kanal ID eksik.");
} else {
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log("[bot.js] Bot hazır.");
}

const escape = (str) => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// === BUY DETECTED ===
export const sendBuyDetected = async (amountSKYL, costWBNB, wallet, txHash) => {
  if (!bot || !CHAT_ID) return;

  const shortWallet = wallet.slice(0, 6) + "..." + wallet.slice(-4);
  const amount = parseFloat(amountSKYL).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cost = parseFloat(costWBNB).toFixed(6);

  const text = `
$SKYL Buy Detected!

<b>Amount:</b> ${amount} $SKYL
<b>Cost:</b> ${cost} WBNB
<b>Wallet:</b> <code>${escape(shortWallet)}</code>

<a href="https://bscscan.com/tx/${escape(txHash)}">View on BscScan</a>
  `.trim();

  try {
    await bot.sendPhoto(
      CHAT_ID,
      "https://skyl.online/images/Skyhawk_Buy.png",
      {
        caption: text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }
    );
    console.log("[bot.js] BUY bildirimi + görsel gönderildi.");
  } catch (err) {
    console.error("[bot.js] BUY hatası:", err.message);
  }
};

// === AIRDROP CLAIM ===
export const sendAirdropClaim = async ({ wallet, amount }) => {
  if (!bot || !CHAT_ID) return;

  const formatted = parseFloat(amount).toLocaleString("en-US");
  const safeWallet = escape(wallet);

  const text = `
$SKYL Airdrop Claim!

<b>Amount:</b> ${formatted} $SKYL
<b>Wallet:</b> <code>${safeWallet}</code>

<a href="https://bscscan.com/address/${safeWallet}">View on BscScan</a>
  `.trim();

  try {
    await bot.sendPhoto(
      CHAT_ID,
      "https://skyl.online/images/Skyhawk_Airdrop.png",
      {
        caption: text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }
    );
    console.log("[bot.js] Airdrop bildirimi + görsel gönderildi.");
  } catch (err) {
    console.error("[bot.js] Airdrop hatası:", err.message);
  }
};