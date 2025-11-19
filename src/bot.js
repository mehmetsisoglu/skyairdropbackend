// src/bot.js (v17.0 – THE COMPLETE SKYLINE SYSTEM)
// Features: Rank, Stats, AI, Raid, Welcome/Goodbye, Captcha, Whale Alert Support
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import OpenAI from "openai"; 
import { pool } from "./db.js"; // Veritabanı bağlantısı (Rank için)

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID?.trim();
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// --- CONFIGURATION ---
const TOKEN_CA = "0xa7c4436c2Cf6007Dd03c3067697553bd51562f2c"; 
const BUY_LINK = "https://pancakeswap.finance/swap?outputCurrency=" + TOKEN_CA;
const WEBSITE = "https://skyl.online/";
const AIRDROP_PAGE = "https://skyl.online/airdrop/";

// --- IMAGES ---
const IMG_WELCOME = "https://skyl.online/images/Skyhawk_Welcome.png"; 
const IMG_RAID = "https://skyl.online/images/Skyhawk_Raid.png";
const IMG_GOODBYE = "https://skyl.online/images/Skyhawk_Goodbye.png";

// --- AI SETUP ---
let openai = null;
if (OPENAI_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_KEY });
    console.log("[bot.js] OpenAI Enabled.");
}

// --- MEMORY & LIMITS ---
const userCooldowns = new Map();
const captchaPending = new Map(); 
const SPAM_LIMIT_SECONDS = 4;

let bot = null;

if (!TOKEN) {
  console.warn("[bot.js] Token missing! Bot could not start.");
} else {
  // ⚠️ Başlangıçta POLLING FALSE (Conflict Fix için)
  bot = new TelegramBot(TOKEN, { polling: false }); 
  console.log("[bot.js] Bot instance created (Idle Mode).");
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

// --- RANK SYSTEM: UPDATE XP ---
const updateRank = async (userId, username) => {
    try {
        // Kullanıcı yoksa oluştur, varsa XP artır
        const res = await pool.query(`
            INSERT INTO user_ranks (user_id, username, xp, level) 
            VALUES ($1, $2, 1, 'Cadet') 
            ON CONFLICT (user_id) DO UPDATE 
            SET xp = user_ranks.xp + 1, username = $2
            RETURNING xp
        `, [userId, username || 'User']);

        const xp = res.rows[0].xp;
        let newLevel = 'Cadet';
        
        // Rütbe Kuralları
        if (xp > 50) newLevel = 'Pilot ✈️';
        if (xp > 200) newLevel = 'Sky Commander 🦅';
        if (xp > 500) newLevel = 'Legend 🌟';
        if (xp > 1000) newLevel = 'Sky God ⚡';

        // Seviye güncellemesi
        await pool.query('UPDATE user_ranks SET level = $1 WHERE user_id = $2', [newLevel, userId]);
        
    } catch (e) { 
        // Hata durumunda sessiz kal (Chat akışını bozma)
        // console.error("Rank Update Error:", e.message); 
    }
};

// ====================================================
//       SYSTEM STARTUP (Conflict Prevention)
// ====================================================
export const startTelegramBot = async () => {
    if (!bot) return;
    
    try {
        // Eski webhook varsa temizle
        await bot.deleteWebHook();
        console.log("[bot.js] Webhook cleared.");

        // Polling'i manuel başlat
        if (!bot.isPolling()) {
            await bot.startPolling();
            console.log("[bot.js] ✅ Polling Started Successfully.");
        }
    } catch (error) {
        if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
             console.warn("[bot.js] ⚠️ Conflict detected (Another instance running).");
        } else {
             console.error("[bot.js] Startup Error:", error.message);
        }
    }
};

// ====================================================
//           COMMANDS & LOGIC
// ====================================================
if (bot) {
    
    // 1. /help COMMAND
    bot.onText(/\/help/, (msg) => {
        if (checkSpam(msg.from.id)) return;
        const helpMsg = `
🤖 *Skyline Logic AI - Command List*

📊 *Market Data:*
▪️ \`/chart\` → Live Price Chart
▪️ \`/stats\` → Market Cap & Liquidity
▪️ \`/ca\`  → Contract Address

👤 *User Profile:*
▪️ \`/rank\` → Check your Level & XP

🧠 *AI & Info:*
▪️ \`/ask <question>\` → AI Assistant
▪️ \`/socials\` → Official Links

👮‍♂️ *Admin Only:*
▪️ \`/raid <link>\` → Start Raid
▪️ \`/announce <msg>\` → Announcement
        `;
        bot.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
    });

    // 2. /stats COMMAND (DexScreener API)
    bot.onText(/\/stats/, async (msg) => {
        if (checkSpam(msg.from.id)) return;
        const chatId = msg.chat.id;
        
        try {
            // DexScreener'dan veri çek
            const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CA}`);
            const data = await res.json();
            const pair = data.pairs && data.pairs[0];

            if (!pair) return bot.sendMessage(chatId, "⚠️ Token data fetching...");

            const statsMsg = `
📊 *Skyline Logic ($SKYL) Live Stats*

💰 *Price:* $${pair.priceUsd}
💧 *Liquidity:* $${pair.liquidity.usd.toLocaleString()}
🦅 *FDV:* $${pair.fdv.toLocaleString()}
📉 *24h Change:* ${pair.priceChange.h24}%
🔄 *Volume (24h):* $${pair.volume.h24.toLocaleString()}

🔗 [View on DexScreener](${pair.url})
            `;
            bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown', disable_web_page_preview: true });
        } catch (e) {
            bot.sendMessage(chatId, "⚠️ Market data unavailable at the moment.");
        }
    });

    // 3. /rank COMMAND
    bot.onText(/\/rank/, async (msg) => {
        if (checkSpam(msg.from.id)) return;
        const userId = msg.from.id.toString();
        try {
            const res = await pool.query('SELECT * FROM user_ranks WHERE user_id = $1', [userId]);
            if (res.rows.length === 0) return bot.sendMessage(msg.chat.id, "You have no rank yet. Start chatting!");
            
            const { xp, level } = res.rows[0];
            bot.sendMessage(msg.chat.id, `🎖 *Your Rank Card*\n\n👤 User: ${msg.from.first_name}\n🔰 Level: *${level}*\n✨ XP: *${xp}*`, { parse_mode: 'Markdown' });
        } catch (e) { 
            bot.sendMessage(msg.chat.id, "⚠️ Database connecting..."); 
        }
    });

    // 4. /ask COMMAND (AI or Static)
    bot.onText(/\/ask (.+)/, async (msg, match) => {
        if (checkSpam(msg.from.id)) return;
        const question = match[1];
        const chatId = msg.chat.id;

        if (openai) {
            // --- OPENAI ACTIVE ---
            bot.sendChatAction(chatId, 'typing');
            try {
                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: "You are Skyhawk, the mascot and AI assistant of Skyline Logic ($SKYL). You are helpful, futuristic, and bullish on BSC." },
                        { role: "user", content: question }
                    ],
                    model: "gpt-3.5-turbo",
                });
                bot.sendMessage(chatId, completion.choices[0].message.content, { parse_mode: 'Markdown' });
            } catch (e) {
                bot.sendMessage(chatId, "⚠️ AI Overloaded. Please try again.");
            }
        } else {
            // --- FALLBACK (STATIC RESPONSES) ---
            const aiKnowledgeBase = [
                { keys: ["contract", "ca"], answer: `Contract: \`${TOKEN_CA}\`` },
                { keys: ["buy", "pancake"], answer: `Buy here: [Link](${BUY_LINK})` },
                { keys: ["airdrop"], answer: `Claim here: ${AIRDROP_PAGE}` }
            ];
            const found = aiKnowledgeBase.find(item => item.keys.some(k => question.toLowerCase().includes(k)));
            const resp = found ? found.answer : `I am still learning. Check our website: ${WEBSITE}`;
            bot.sendMessage(chatId, resp, { parse_mode: 'Markdown' });
        }
    });

    // 5. STANDARD COMMANDS
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

🌍 [Website](${WEBSITE})
🐦 [X (Twitter)](https://x.com/SkylineLogicAI)
✈️ [Telegram](https://t.me/SkylineLogicChat)
📸 [Instagram](https://www.instagram.com/skyline.logic)
        `;
        bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    });

    // 6. ADMIN: RAID & ANNOUNCE
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

    bot.onText(/\/announce([\s\S]+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        try {
            const member = await bot.getChatMember(chatId, userId);
            if (!['creator', 'administrator'].includes(member.status)) {
                return bot.sendMessage(chatId, "⛔ Only admins can use this command.");
            }
            bot.deleteMessage(chatId, msg.message_id).catch(()=>{});
            const announcement = `📢 *ANNOUNCEMENT*\n\n${match[1].trim()}\n\n🚀 *$SKYL Team*`;
            await bot.sendMessage(chatId, announcement, { parse_mode: 'Markdown' });
        } catch (e) {}
    });

    // 7. MESSAGE LISTENER (XP + Auto-Mod)
    bot.on('message', async (msg) => {
        // Komutları ve botları yoksay
        if (!msg.text || msg.text.startsWith('/') || msg.from.is_bot) return;
        
        // XP Kazanma
        await updateRank(msg.from.id.toString(), msg.from.username || msg.from.first_name);

        // Auto-Mod (FUD Protection)
        const text = msg.text.toLowerCase();
        if (["scam", "rug", "honeypot", "fake"].some(w => text.includes(w))) {
             bot.deleteMessage(msg.chat.id, msg.message_id).catch(()=>{});
             bot.sendMessage(msg.chat.id, "🚫 *No FUD allowed!* Trust the Logic.", { parse_mode: 'Markdown' });
        }
        
        // Hype Triggers
        if (text.includes("moon") || text.includes("lambo")) {
             bot.sendMessage(msg.chat.id, "🚀 *To the Sky!* $SKYL taking off.", { parse_mode: 'Markdown' });
        }
    });

    // 8. WELCOME + CAPTCHA
    bot.on('new_chat_members', async (msg) => {
        const chatId = msg.chat.id;
        for (const member of msg.new_chat_members) {
            if (member.is_bot) continue;
            
            // 1. Sustur
            try { await bot.restrictChatMember(chatId, member.id, { can_send_messages: false }); } catch (e) {}

            // 2. Soru Hazırla
            const n1 = Math.floor(Math.random()*5)+1, n2 = Math.floor(Math.random()*5)+1;
            const ans = n1+n2;
            const opts = [
                { text: `${n1}+${n2}=${ans}`, callback_data: `cap_ok_${member.id}` },
                { text: `${n1}+${n2}=${ans+1}`, callback_data: `cap_no_${member.id}` }
            ].sort(()=>Math.random()-0.5);

            // 3. Karşılama Mesajı
            const sent = await bot.sendPhoto(chatId, IMG_WELCOME, {
                caption: `👋 *Welcome, ${member.first_name}!*\n\nTo chat in *Skyline Logic*, please prove you are human.\n*Solve:* ${n1} + ${n2} = ?`,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [opts] }
            });
            
            // 4. Süre Sayacı (60sn)
            captchaPending.set(member.id, sent.message_id);
            setTimeout(()=>{ if(captchaPending.has(member.id)) bot.deleteMessage(chatId, sent.message_id).catch(()=>{}); }, 60000);
        }
    });

    // 9. CAPTCHA CALLBACK
    bot.on('callback_query', async (q) => {
        const [type, status, id] = q.data.split('_'); 
        if (type !== 'cap') return;
        if (q.from.id != id) return bot.answerCallbackQuery(q.id, {text:"This verification is not for you!", show_alert:true});
        
        if (status === 'ok') {
            try { 
                // Yasağı kaldır
                await bot.restrictChatMember(q.message.chat.id, id, { 
                    can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true 
                }); 
            } catch(e){}
            
            await bot.answerCallbackQuery(q.id, {text:"Verified!"});
            bot.deleteMessage(q.message.chat.id, q.message.message_id).catch(()=>{});
            bot.sendMessage(q.message.chat.id, `✅ Verified! Welcome to the community.\nCheck /help for commands.`, { disable_notification: true });
        } else {
            bot.answerCallbackQuery(q.id, {text:"Wrong answer! Try again.", show_alert:true});
        }
    });

    // 10. GOODBYE MESSAGE
    bot.on('left_chat_member', async (msg) => {
        const chatId = msg.chat.id;
        const leftMember = msg.left_chat_member;
        if (leftMember.is_bot) return;

        const goodbyeCaption = `
👋 *Goodbye, ${leftMember.first_name}...*

You have disconnected from the Skyline Logic network.
We hope to see you flying with us again.

🦅 _Skyhawk is watching the horizon._
        `;
        try { await bot.sendPhoto(chatId, IMG_GOODBYE, { caption: goodbyeCaption, parse_mode: 'Markdown' }); } 
        catch (e) { bot.sendMessage(chatId, goodbyeCaption, { parse_mode: 'Markdown' }); }
    });
}

// ====================================================
//             EXPORTS (NOTIFICATION SYSTEM)
// ====================================================

// BUY ALERT (Supports Custom Images for Whales)
export const sendBuyDetected = async (amountSKYL, costWBNB, wallet, txHash, imageURL) => {
  if (!bot || !CHAT_ID) return;
  
  const txt = `
$SKYL Buy Detected!
<b>Amount:</b> ${parseFloat(amountSKYL).toFixed(0)} $SKYL
<b>Cost:</b> ${parseFloat(costWBNB).toFixed(4)} BNB
<b>Wallet:</b> <code>${escape(wallet.slice(0,6)+'...'+wallet.slice(-4))}</code>
<a href="https://bscscan.com/tx/${escape(txHash)}">View on BscScan</a>`.trim();

  const finalImg = imageURL || "https://skyl.online/images/Skyhawk_Buy.png";

  try { await bot.sendPhoto(CHAT_ID, finalImg, { caption: txt, parse_mode: "HTML" }); } 
  catch (e) { console.error("Buy Alert Error:", e.message); }
};

// AIRDROP ALERT
export const sendAirdropClaim = async ({ wallet, amount }) => {
  if (!bot || !CHAT_ID) return;
  
  const txt = `
$SKYL Airdrop Claim!
<b>Amount:</b> ${parseFloat(amount).toLocaleString()} $SKYL
<b>Wallet:</b> <code>${escape(wallet)}</code>
<a href="https://bscscan.com/address/${escape(wallet)}">View on BscScan</a>`.trim();
  
  try { await bot.sendPhoto(CHAT_ID, "https://skyl.online/images/Skyhawk_Airdrop.png", { caption: txt, parse_mode: "HTML" }); } 
  catch (e) { console.error("Airdrop Alert Error:", e.message); }
};
