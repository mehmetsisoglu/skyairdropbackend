// src/bot.js (v14.1 – FIX: Announce Regex & AI Logic Isolation)
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

// --- GÖRSELLER ---
const IMG_WELCOME = "https://skyl.online/images/Skyhawk_Welcome.png"; 
const IMG_RAID = "https://skyl.online/images/Skyhawk_Raid.png";       

// --- MEMORY ---
const userCooldowns = new Map();
const captchaPending = new Map(); 
const SPAM_LIMIT_SECONDS = 4;

let bot = null;

if (!TOKEN) {
  console.warn("[bot.js] Token eksik!");
} else {
  // Polling FALSE başlıyor (buy-bot.js başlatacak)
  bot = new TelegramBot(TOKEN, { polling: false }); 
  console.log("[bot.js] Bot instance created.");
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
//       BAŞLATMA (Conflict Fix)
// ====================================================
export const startTelegramBot = async () => {
    if (!bot) return;
    try {
        await bot.deleteWebHook();
        if (!bot.isPolling()) {
            await bot.startPolling();
            console.log("[bot.js] ✅ Polling Başlatıldı.");
        }
    } catch (error) {
        if (!error.message.includes('409')) console.error("[bot.js] Start Error:", error.message);
    }
};

// ====================================================
//           KOMUTLAR
// ====================================================
if (bot) {
    
    // 1. ADMIN ANNOUNCEMENT (/announce)
    // DÜZELTME: Regex ([\s\S]+) yapıldı, böylece alt satırlar ve emojiler de alınır.
    bot.onText(/\/announce([\s\S]+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const textToAnnounce = match[1].trim(); // Boşlukları temizle

        // GÜVENLİK KONTROLÜ
        try {
            const member = await bot.getChatMember(chatId, userId);
            if (!['creator', 'administrator'].includes(member.status)) {
                // Sessizce reddet veya uyar
                return bot.sendMessage(chatId, "⛔ Only admins can use this command.");
            }

            // Eski mesajı sil
            bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

            // Duyuruyu gönder
            const announcement = `📢 *ANNOUNCEMENT*\n\n${textToAnnounce}\n\n🚀 *$SKYL Team*`;
            await bot.sendMessage(chatId, announcement, { parse_mode: 'Markdown' });

        } catch (e) {
            console.error("Announce Error:", e.message);
        }
    });

    // 2. AI Assistant (/ask)
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

    // 3. Temel Komutlar
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
    
    // 4. Raid Bot (/raid)
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

    // 5. KEYWORD TRIGGERS (Message Handler)
    // DÜZELTME: '/announce' gibi komutların buraya düşmesini engelliyoruz.
    bot.on('message', (msg) => {
        // Eğer mesaj boşsa veya "/" ile başlıyorsa (yani komutsa) HİÇBİR ŞEY YAPMA
        if (!msg.text || msg.text.startsWith('/')) return; 

        const text = msg.text.toLowerCase();
        const chatId = msg.chat.id;

        // FUD & Hype Check
        const fudWords = ["scam", "rug", "honeypot", "fake"];
        if (fudWords.some(w => text.includes(w))) {
             bot.sendMessage(chatId, "🚫 *No FUD allowed!* Trust the Logic.", { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
        }
        if (text.includes("moon") || text.includes("lambo")) {
             bot.sendMessage(chatId, "🚀 *To the Sky!* $SKYL taking off.", { parse_mode: 'Markdown' });
        }
    });

    // 6. Welcome & Captcha
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

    bot.on('callback_query', async (q) => {
        const [type, status, id] = q.data.split('_'); 
        if (type !== 'cap') return;
        if (q.from.id != id) return bot.answerCallbackQuery(q.id, {text:"Not for you!", show_alert:true});
        
        if (status === 'ok') {
            try { await bot.restrictChatMember(q.message.chat.id, id, { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true }); } catch(e){}
            await bot.answerCallbackQuery(q.id, {text:"Verified!"});
            bot.deleteMessage(q.message.chat.id, q.message.message_id).catch(()=>{});
            bot.sendMessage(q.message.chat.id, `✅ Verified! Check /ca and /chart`, { disable_notification: true });
        } else {
            bot.answerCallbackQuery(q.id, {text:"Wrong answer!", show_alert:true});
        }
    });
}

// ====================================================
//             EXPORTS
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
