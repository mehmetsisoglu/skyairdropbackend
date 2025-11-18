// src/bot.js (v15.0 – MASTER FINAL: All Features + Goodbye + Conflict Fix)
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID?.trim();

// --- CONFIGURATION ---
const TOKEN_CA = "0xa7c4436c2Cf6007Dd03c3067697553bd51562f2c"; 
const BUY_LINK = "https://pancakeswap.finance/swap?outputCurrency=" + TOKEN_CA;
const WEBSITE = "https://skyl.online/";
const AIRDROP_PAGE = "https://skyl.online/airdrop/";

// --- IMAGES ---
const IMG_WELCOME = "https://skyl.online/images/Skyhawk_Welcome.png"; 
const IMG_RAID = "https://skyl.online/images/Skyhawk_Raid.png";
const IMG_GOODBYE = "https://skyl.online/images/Skyhawk_Goodbye.png";       

// --- MEMORY & LIMITS ---
const userCooldowns = new Map();
const captchaPending = new Map(); 
const SPAM_LIMIT_SECONDS = 4;

let bot = null;

if (!TOKEN) {
  console.warn("[bot.js] Token missing! Bot could not start.");
} else {
  // ⚠️ POLLING FALSE: Başlangıçta kapalı (buy-bot.js başlatacak)
  bot = new TelegramBot(TOKEN, { polling: false }); 
  console.log("[bot.js] Bot instance created (Idle).");
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

// ====================================================
//       STARTUP LOGIC (Prevents 409 Conflict)
// ====================================================
export const startTelegramBot = async () => {
    if (!bot) return;
    try {
        await bot.deleteWebHook(); // Temiz başlangıç
        if (!bot.isPolling()) {
            await bot.startPolling();
            console.log("[bot.js] ✅ Polling (Listening) Started.");
        }
    } catch (error) {
        if (!error.message.includes('409')) console.error("[bot.js] Start Error:", error.message);
    }
};

// ====================================================
//           COMMANDS & LOGIC
// ====================================================
if (bot) {
    
    // 1. HELP COMMAND (/help)
    bot.onText(/\/help/, (msg) => {
        if (checkSpam(msg.from.id)) return;
        const helpMsg = `
🤖 *Skyline Logic AI - Command List*

📌 *Investor Commands:*
▪️ \`/ca\`  → Get Contract Address
▪️ \`/chart\` → View Live Chart
▪️ \`/socials\` → Official Social Links
▪️ \`/ask <question>\` → Ask AI Assistant

🛡️ *Security & Fun:*
▪️ *Anti-FUD:* Active
▪️ *Captcha:* Active
▪️ *Raid System:* Ready

👮‍♂️ *Admin Only:*
▪️ \`/raid <link>\` → Start a Raid
▪️ \`/announce <msg>\` → Make an announcement
        `;
        bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
    });

    // 2. ADMIN ANNOUNCEMENT (/announce)
    bot.onText(/\/announce([\s\S]+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const textToAnnounce = match[1].trim();

        try {
            const member = await bot.getChatMember(chatId, userId);
            if (!['creator', 'administrator'].includes(member.status)) {
                return bot.sendMessage(chatId, "⛔ Only admins can use this command.");
            }
            
            bot.deleteMessage(chatId, msg.message_id).catch(()=>{});
            const announcement = `📢 *ANNOUNCEMENT*\n\n${textToAnnounce}\n\n🚀 *$SKYL Team*`;
            await bot.sendMessage(chatId, announcement, { parse_mode: 'Markdown' });

        } catch (e) { console.error("Announce Error:", e.message); }
    });

    // 3. AI Assistant (/ask)
    const aiKnowledgeBase = [
        { keys: ["contract", "ca", "address"], answer: `The Official Contract is:\n\`${TOKEN_CA}\`` },
        { keys: ["buy", "how to", "purchase"], answer: `You can buy $SKYL on PancakeSwap here: [Buy Link](${BUY_LINK})` },
        { keys: ["airdrop", "claim"], answer: `The Airdrop is live! Visit: ${AIRDROP_PAGE}` },
        { keys: ["chart", "price"], answer: "Type /chart for live price." }
    ];

    bot.onText(/\/ask (.+)/, (msg, match) => {
        if (checkSpam(msg.from.id)) return;
        const question = match[1].toLowerCase();
        const found = aiKnowledgeBase.find(item => item.keys.some(k => question.includes(k)));
        const response = found 
            ? `🤖 *Skyline Logic:* ${found.answer}` 
            : `🤖 *Skyline Logic:* I am analyzing this... Check our [Website](${WEBSITE}) for details.`;
        bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown', disable_web_page_preview: true });
    });

    // 4. Basic Commands (/ca, /chart, /socials)
    bot.onText(/\/ca/, (msg) => {
        if (checkSpam(msg.from.id)) return;
        bot.sendMessage(msg.chat.id, `💎 *Contract:* \`${TOKEN_CA}\`\n_(Tap to copy)_`, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/chart/, (msg) => {
        if (checkSpam(msg.from.id)) return;
        const pair = process.env.PANCAKESWAP_PAIR_ADDRESS || TOKEN_CA;
        bot.sendMessage(msg.chat.id, "📈 *Live Charts*", {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '🦅 DexScreener', url: `https://dexscreener.com/bsc/${pair}` }]] }
        });
    });

    bot.onText(/\/(socials|site|links)/, (msg) => {
        if (checkSpam(msg.from.id)) return;
        const message = `
🌐 *Skyline Logic Official Links*
🌍 [Website](${WEBSITE}) | 🐦 [Twitter](https://x.com/SkylineLogicAI)
✈️ [Telegram](https://t.me/SkylineLogicChat) | 📸 [Instagram](https://www.instagram.com/skyline.logic)
        `;
        bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    });
    
    // 5. Raid Bot (/raid)
    bot.onText(/\/raid (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        try {
            const member = await bot.getChatMember(chatId, userId);
            if (!['creator', 'administrator'].includes(member.status)) return;
            
            bot.deleteMessage(chatId, msg.message_id).catch(()=>{});
            await bot.sendPhoto(chatId, IMG_RAID, {
                caption: `🚨 *SKYLINE RAID ALERT*\n\n👇 *SMASH THIS TWEET* 👇`,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '⚔️ ATTACK NOW ⚔️', url: match[1] }]] }
            });
        } catch (e) {}
    });

    // 6. Keyword Triggers (Auto-Mod)
    bot.on('message', (msg) => {
        if (!msg.text || msg.text.startsWith('/')) return; 
        const text = msg.text.toLowerCase();
        const chatId = msg.chat.id;

        if (["scam", "rug", "honeypot", "fake"].some(w => text.includes(w))) {
             bot.sendMessage(chatId, "🚫 *No FUD allowed!* Trust the Logic.", { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
        }
        if (text.includes("moon") || text.includes("lambo")) {
             bot.sendMessage(chatId, "🚀 *To the Sky!* $SKYL taking off.", { parse_mode: 'Markdown' });
        }
    });

    // 7. Welcome + Captcha
    bot.on('new_chat_members', async (msg) => {
        const chatId = msg.chat.id;
        for (const member of msg.new_chat_members) {
            if (member.is_bot) continue;
            try { await bot.restrictChatMember(chatId, member.id, { can_send_messages: false }); } catch (e) {}

            const n1 = Math.floor(Math.random()*5)+1, n2 = Math.floor(Math.random()*5)+1;
            const ans = n1+n2;
            const opts = [
                { text: `${n1}+${n2}=${ans}`, callback_data: `cap_ok_${member.id}` },
                { text: `${n1}+${n2}=${ans+1}`, callback_data: `cap_no_${member.id}` }
            ].sort(()=>Math.random()-0.5);

            const sent = await bot.sendPhoto(chatId, IMG_WELCOME, {
                caption: `👋 *Welcome, ${member.first_name}!*\nProve you are human: ${n1} + ${n2} = ?`,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [opts] }
            });
            captchaPending.set(member.id, sent.message_id);
            setTimeout(()=>{ if(captchaPending.has(member.id)) bot.deleteMessage(chatId, sent.message_id).catch(()=>{}); }, 60000);
        }
    });

    // 8. Goodbye Message (Member Left)
    bot.on('left_chat_member', async (msg) => {
        const chatId = msg.chat.id;
        const leftMember = msg.left_chat_member;
        if (leftMember.is_bot) return;

        const goodbyeCaption = `
👋 *Goodbye, ${leftMember.first_name}...*

You have disconnected from the Skyline Logic network.
We hope to see you flying with us again one day.

🦅 _Skyhawk is watching the horizon._
        `;
        try { await bot.sendPhoto(chatId, IMG_GOODBYE, { caption: goodbyeCaption, parse_mode: 'Markdown' }); } 
        catch (e) { bot.sendMessage(chatId, goodbyeCaption, { parse_mode: 'Markdown' }); }
    });

    // Captcha Callback Logic
    bot.on('callback_query', async (q) => {
        const [type, status, id] = q.data.split('_'); 
        if (type !== 'cap') return;
        if (q.from.id != id) return bot.answerCallbackQuery(q.id, {text:"Not for you!", show_alert:true});
        
        if (status === 'ok') {
            try { await bot.restrictChatMember(q.message.chat.id, id, { 
                can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true 
            }); } catch(e){}
            
            await bot.answerCallbackQuery(q.id, {text:"Verified!"});
            bot.deleteMessage(q.message.chat.id, q.message.message_id).catch(()=>{});
            bot.sendMessage(q.message.chat.id, `✅ Verified! Check /ca and /chart`, { disable_notification: true });
        } else {
            bot.answerCallbackQuery(q.id, {text:"Wrong answer!", show_alert:true});
        }
    });
}

// ====================================================
//             EXPORTS (NOTIFICATIONS)
// ====================================================
export const sendBuyDetected = async (amountSKYL, costWBNB, wallet, txHash) => {
  if (!bot || !CHAT_ID) return;
  const txt = `
$SKYL Buy Detected!
<b>Amount:</b> ${parseFloat(amountSKYL).toFixed(0)} $SKYL
<b>Cost:</b> ${parseFloat(costWBNB).toFixed(6)} WBNB
<b>Wallet:</b> <code>${escape(wallet.slice(0,6)+'...'+wallet.slice(-4))}</code>
<a href="https://bscscan.com/tx/${escape(txHash)}">View on BscScan</a>`.trim();
  try { await bot.sendPhoto(CHAT_ID, "https://skyl.online/images/Skyhawk_Buy.png", { caption: txt, parse_mode: "HTML" }); } catch (e) {}
};

export const sendAirdropClaim = async ({ wallet, amount }) => {
  if (!bot || !CHAT_ID) return;
  const txt = `
$SKYL Airdrop Claim!
<b>Amount:</b> ${parseFloat(amount).toLocaleString()} $SKYL
<b>Wallet:</b> <code>${escape(wallet)}</code>
<a href="https://bscscan.com/address/${escape(wallet)}">View on BscScan</a>`.trim();
  try { await bot.sendPhoto(CHAT_ID, "https://skyl.online/images/Skyhawk_Airdrop.png", { caption: txt, parse_mode: "HTML" }); } catch (e) {}
};
