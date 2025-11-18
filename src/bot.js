// src/bot.js (v12.0 – ULTIMATE EDITION: Raid + AI + Captcha + Triggers + Welcome)
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID?.trim();

// --- CONFIGURATION ---
const TOKEN_CA = "0xa7c4436c2Cf6007Dd03c3067697553bd51562f2c"; // $SKYL
const BUY_LINK = "https://pancakeswap.finance/swap?outputCurrency=" + TOKEN_CA;
const WEBSITE = "https://skyl.online/";
const AIRDROP_PAGE = "https://skyl.online/airdrop/";

// --- IMAGES (Replace these with your actual hosted image URLs) ---
const IMG_WELCOME = "https://skyl.online/images/Skyhawk_Welcome.png"; // Hoş geldin resmi
const IMG_RAID = "https://skyl.online/images/Skyhawk_Raid.png";       // Raid resmi

// --- MEMORY STORAGES ---
const userCooldowns = new Map();
const captchaPending = new Map(); // Stores pending captchas { userId: { answer, messageId } }
const SPAM_LIMIT_SECONDS = 5;

let bot = null;

if (!TOKEN) {
  console.warn("[bot.js] Token missing! Bot could not start.");
} else {
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log("[bot.js] Skyline Logic AI System Online.");
}

const escape = (str) => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- SPAM CHECK ---
const checkSpam = (userId) => {
    const currentTime = Date.now();
    if (userCooldowns.has(userId)) {
        const lastTime = userCooldowns.get(userId);
        if ((currentTime - lastTime) / 1000 < SPAM_LIMIT_SECONDS) return true;
    }
    userCooldowns.set(userId, currentTime);
    return false;
};

// --- LOGIC CORE (AI Knowledge Base) ---
const aiKnowledgeBase = [
    { keys: ["contract", "ca", "address"], answer: `The Official Contract is:\n\`${TOKEN_CA}\`` },
    { keys: ["buy", "how to", "purchase"], answer: `You can buy $SKYL on PancakeSwap here: [Buy Link](${BUY_LINK})` },
    { keys: ["airdrop", "claim"], answer: `The Airdrop is live! Visit: ${AIRDROP_PAGE}` },
    { keys: ["price", "chart"], answer: "Use /chart to see the live price action." },
    { keys: ["utility", "use case"], answer: "Skyline Logic AI provides advanced blockchain analytics and automated trading tools." },
    { keys: ["team", "dev"], answer: "The team is anonymous but KYC verified. We are building the future of AI on BSC." }
];

if (bot) {
  // ====================================================
  //           1. COMMANDS & AI ASSISTANT
  // ====================================================

  // /ask <question> (AI Assistant Mode)
  bot.onText(/\/ask (.+)/, (msg, match) => {
      if (checkSpam(msg.from.id)) return;
      const question = match[1].toLowerCase();
      
      // Simple "Logic" Search
      const found = aiKnowledgeBase.find(item => item.keys.some(k => question.includes(k)));
      
      const response = found 
          ? `🤖 *Skyline Logic:* ${found.answer}`
          : `🤖 *Skyline Logic:* I am still learning. Please check our [Website](${WEBSITE}) for detailed info.`;

      bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown', disable_web_page_preview: true });
  });

  // Standard Commands
  bot.onText(/\/ca/, (msg) => {
      if (checkSpam(msg.from.id)) return;
      bot.sendMessage(msg.chat.id, `💎 *Contract:* \`${TOKEN_CA}\``, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/chart/, (msg) => {
      if (checkSpam(msg.from.id)) return;
      const pairAddress = process.env.PANCAKESWAP_PAIR_ADDRESS || TOKEN_CA;
      bot.sendMessage(msg.chat.id, "📈 *Live Charts*", {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [[{ text: '🦅 DexScreener', url: `https://dexscreener.com/bsc/${pairAddress}` }]] }
      });
  });

  // ====================================================
  //           2. RAID BOT (/raid <link>)
  // ====================================================
  bot.onText(/\/raid (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const raidLink = match[1];

      // Security: Admin Only
      try {
          const member = await bot.getChatMember(chatId, userId);
          if (!['creator', 'administrator'].includes(member.status)) return;

          bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

          const caption = `
🚨 *SKYLINE RAID ALERT* 🚨

🛡️ *Objective:* SMASH THE LINK BELOW!
🔥 *Reward:* Glory for the Community!

👇 *GO GO GO* 👇
          `;

          // Send generic Raid Image (or you can use file_id)
          // If IMG_RAID url fails, it sends text only.
          try {
              await bot.sendPhoto(chatId, IMG_RAID, {
                  caption: caption,
                  parse_mode: 'Markdown',
                  reply_markup: {
                      inline_keyboard: [[{ text: '⚔️ ATTACK TWEET ⚔️', url: raidLink }]]
                  }
              });
          } catch {
              bot.sendMessage(chatId, caption + `\n🔗 ${raidLink}`, { parse_mode: 'Markdown' });
          }

      } catch (e) { console.error("Raid error", e); }
  });

  // ====================================================
  //           3. KEYWORD TRIGGERS & AUTO-MOD
  // ====================================================
  bot.on('message', (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return; // Ignore commands
      const text = msg.text.toLowerCase();
      const chatId = msg.chat.id;

      // A. FUD Protection
      const fudWords = ["scam", "rug", "honeypot", "dead project"];
      if (fudWords.some(w => text.includes(w))) {
          bot.sendMessage(chatId, "🚫 *No FUD allowed!* We are building for the long term. Trust the Logic.", { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
      }

      // B. Hype Triggers
      if (text.includes("moon") || text.includes("lambo")) {
          bot.sendMessage(chatId, "🚀 *To the Sky!* $SKYL is ready for takeoff.", { parse_mode: 'Markdown' });
      }
      
      if (text.includes("gm")) {
           bot.sendMessage(chatId, "☕ *GM!* Have a productive day, legend.");
      }
  });

  // ====================================================
  //           4. WELCOME + MATH CAPTCHA
  // ====================================================
  bot.on('new_chat_members', async (msg) => {
      const chatId = msg.chat.id;
      const newMembers = msg.new_chat_members;

      for (const member of newMembers) {
          if (member.is_bot) continue;

          // 1. Restrict User (Mute)
          try {
              await bot.restrictChatMember(chatId, member.id, {
                  can_send_messages: false,
                  can_send_media_messages: false,
                  can_send_other_messages: false
              });
          } catch (e) { console.log("Bot needs Admin rights to restrict users."); }

          // 2. Generate Math Problem
          const num1 = Math.floor(Math.random() * 10) + 1;
          const num2 = Math.floor(Math.random() * 10) + 1;
          const answer = num1 + num2;
          
          // Generate wrong answers
          let w1 = answer + 1;
          let w2 = answer - 1;
          if (w1 === w2) w2 = answer + 2;

          const options = [
              { text: `${num1} + ${num2} = ${answer}`, callback_data: `captcha_correct_${member.id}` },
              { text: `${num1} + ${num2} = ${w1}`, callback_data: `captcha_wrong_${member.id}` },
              { text: `${num1} + ${num2} = ${w2}`, callback_data: `captcha_wrong_${member.id}` }
          ].sort(() => Math.random() - 0.5); // Shuffle

          // 3. Send Welcome Image with Captcha
          const welcomeCaption = `
👋 *Welcome, ${member.first_name}!*

To chat in *Skyline Logic*, please prove you are human.
*Solve:* ${num1} + ${num2} = ?
          `;

          const sentMsg = await bot.sendPhoto(chatId, IMG_WELCOME, {
              caption: welcomeCaption,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [options] }
          });

          // Store Captcha Data
          captchaPending.set(member.id, { msgId: sentMsg.message_id, correct: answer });
          
          // Auto-kick if not solved in 2 mins (Optional - Keeping it simple: just delete captcha msg)
          setTimeout(() => {
             if(captchaPending.has(member.id)) {
                 bot.deleteMessage(chatId, sentMsg.message_id).catch(()=>{});
                 captchaPending.delete(member.id);
             }
          }, 120000);
      }
  });

  // ====================================================
  //           5. CAPTCHA HANDLER (CALLBACKS)
  // ====================================================
  bot.on('callback_query', async (query) => {
      const data = query.data;
      const userId = query.from.id;
      const chatId = query.message.chat.id;

      if (!data.startsWith('captcha_')) return;

      const targetId = parseInt(data.split('_')[2]);
      
      // Only the specific user can click
      if (userId !== targetId) {
          return bot.answerCallbackQuery(query.id, { text: "This captcha is not for you!", show_alert: true });
      }

      if (data.includes('correct')) {
          // UNMUTE USER
          try {
              await bot.restrictChatMember(chatId, userId, {
                  can_send_messages: true,
                  can_send_media_messages: true,
                  can_send_other_messages: true,
                  can_add_web_page_previews: true
              });
              
              await bot.answerCallbackQuery(query.id, { text: "Verified! Welcome to the Sky." });
              await bot.deleteMessage(chatId, query.message.message_id);
              
              // Optional: Send clean text commands list after verify
              bot.sendMessage(chatId, `✅ Verified! Checkout /chart and /ca`, { disable_notification: true });
              
              captchaPending.delete(userId);

          } catch (e) { console.error("Captcha Unmute Error:", e.message); }

      } else {
          // WRONG ANSWER
          await bot.answerCallbackQuery(query.id, { text: "Wrong answer! Try again.", show_alert: true });
      }
  });
}

// ====================================================
//             EXPORTED FUNCTIONS
// ====================================================

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
    await bot.sendPhoto(CHAT_ID, "https://skyl.online/images/Skyhawk_Buy.png", { caption: text, parse_mode: "HTML" });
  } catch (err) { console.error("Buy Alert Error", err.message); }
};

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
    await bot.sendPhoto(CHAT_ID, "https://skyl.online/images/Skyhawk_Airdrop.png", { caption: text, parse_mode: "HTML" });
  } catch (err) { console.error("Airdrop Alert Error", err.message); }
};
