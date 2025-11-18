// src/bot.js (v10.0 – SKYHAWK + KOMUTLAR + SPAM KORUMASI)
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID?.trim();

// --- YENİ AYARLAR ---
const TOKEN_CA = "0xa7c4436c2Cf6007Dd03c3067697553bd51562f2c"; // $SKYL
const BUY_LINK = "https://pancakeswap.finance/swap?outputCurrency=" + TOKEN_CA;
const WEBSITE = "https://skyl.online/";
const AIRDROP_PAGE = "https://skyl.online/airdrop/";

// Spam Koruması (Hafıza)
const userCooldowns = new Map();
const SPAM_LIMIT_SECONDS = 10; 

let bot = null;

if (!TOKEN) {
  console.warn("[bot.js] Token eksik! Bot başlatılamadı.");
} else {
  // ÖNEMLİ: Komutları dinlemek için polling: true yaptık
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log("[bot.js] Bot ve Komut sistemi hazır (Polling Active).");
}

const escape = (str) => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- SPAM KONTROL FONKSİYONU ---
const checkSpam = (userId) => {
    const currentTime = Date.now();
    if (userCooldowns.has(userId)) {
        const lastTime = userCooldowns.get(userId);
        if ((currentTime - lastTime) / 1000 < SPAM_LIMIT_SECONDS) {
            return true; // Spam yapıyor
        }
    }
    userCooldowns.set(userId, currentTime);
    return false; // Temiz
};

// ====================================================
//                YENİ KOMUTLAR
// ====================================================

if (bot) {
  // 1. /ca KOMUTU
  bot.onText(/\/ca/, (msg) => {
      if (checkSpam(msg.from.id)) return;

      const message = `
💎 *Skyline Logic ($SKYL) Contract:*

\`${TOKEN_CA}\`

_(Kopyalamak için adrese dokunun)_
`;
      bot.sendMessage(msg.chat.id, message, {
          parse_mode: 'Markdown',
          reply_markup: {
              inline_keyboard: [[{ text: '🥞 Buy on PancakeSwap', url: BUY_LINK }]]
          }
      });
  });

  // 2. /chart KOMUTU
  bot.onText(/\/chart/, (msg) => {
      if (checkSpam(msg.from.id)) return;
      
      const pairAddress = process.env.PANCAKESWAP_PAIR_ADDRESS || TOKEN_CA;

      bot.sendMessage(msg.chat.id, "📈 *$SKYL Canlı Grafik*", {
          parse_mode: 'Markdown',
          reply_markup: {
              inline_keyboard: [
                  [
                      { text: '🦅 DexScreener', url: `https://dexscreener.com/bsc/${pairAddress}` },
                      { text: '💩 Poocoin', url: `https://poocoin.app/tokens/${TOKEN_CA}` }
                  ]
              ]
          }
      });
  });

  // 3. /socials ve /site KOMUTU
  bot.onText(/\/(socials|site|linkler)/, (msg) => {
      if (checkSpam(msg.from.id)) return;

      const message = `
🌐 *Skyline Logic Resmi Bağlantılar*

🌍 [Web Sitesi](${WEBSITE})
🎁 [Airdrop Sayfası](${AIRDROP_PAGE})

🐦 [X (Twitter)](https://x.com/SkylineLogicAI)
✈️ [Telegram](https://t.me/SkylineLogicChat)
📸 [Instagram](https://www.instagram.com/skyline.logic)
🎵 [TikTok](https://www.tiktok.com/@skylinelogicai)
      `;
      
      bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
  });
}

// ====================================================
//             DIŞA AKTARILAN FONKSİYONLAR
// ====================================================

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
    console.log("[bot.js] BUY bildirimi gönderildi.");
  } catch (err) {
    console.error("[bot.js] BUY hatası:", err.message);
  }
};

// === AIRDROP CLAIM ===
export const sendAirdropClaim = async ({ wallet, amount }) => {
  if (!bot || !CHAT_ID) return;

  const formatted = parseFloat(amount || 0).toLocaleString("en-US");
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
    console.log("[bot.js] Airdrop bildirimi gönderildi.");
  } catch (err) {
    console.error("[bot.js] Airdrop hatası:", err.message);
  }
};
