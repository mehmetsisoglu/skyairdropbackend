// src/bot.js (v26.0 – FULL SYSTEM: All Features Preserved + Webhook Support)
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import OpenAI from "openai"; 
import axios from "axios"; 
import { pool } from "./db.js"; 

dotenv.config();

// --- API ANAHTARLARI VE AYARLAR ---
const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID?.trim();
const OPENAI_KEY = process.env.OPENAI_API_KEY;
// Render'ın bize verdiği otomatik URL (Webhook için gerekli)
const RENDER_URL = process.env.RENDER_EXTERNAL_URL; 

// --- PROJE BİLGİLERİ ---
const TOKEN_CA = "0xa7c4436c2Cf6007Dd03c3067697553bd51562f2c"; 
const BUY_LINK = "https://pancakeswap.finance/swap?outputCurrency=" + TOKEN_CA;
const WEBSITE = "https://skyl.online/";
const AIRDROP_PAGE = "https://skyl.online/airdrop/";

// --- GÖRSELLER (Skyhawk Serisi) ---
const IMG_WELCOME = "https://skyl.online/images/Skyhawk_Welcome.png"; 
const IMG_RAID = "https://skyl.online/images/Skyhawk_Raid.png";
const IMG_GOODBYE = "https://skyl.online/images/Skyhawk_Goodbye.png";
const IMG_DEFAULT_BUY = "https://skyl.online/images/Skyhawk_Buy.png";

// --- AI BAŞLATMA ---
let openai = null;
if (OPENAI_KEY) {
    try {
        openai = new OpenAI({ apiKey: OPENAI_KEY });
        console.log("[bot.js] OpenAI (ChatGPT) Aktif.");
    } catch (e) { 
        console.error("[bot.js] OpenAI Başlatılamadı:", e.message); 
    }
}

// --- HAFIZA VE LİMİTLER ---
const userCooldowns = new Map();
const captchaPending = new Map(); 
const SPAM_LIMIT_SECONDS = 3; 

// --- BOT NESNESİ OLUŞTURMA ---
let bot = null;
if (!TOKEN) {
  console.warn("[bot.js] UYARI: Telegram Token eksik!");
} else {
  // ⚠️ KRİTİK: Polling'i 'false' yapıyoruz.
  // Eğer Render'daysak Webhook, Local'deysek Polling'i manuel açacağız.
  bot = new TelegramBot(TOKEN, { 
      polling: false,
      request: { agentOptions: { keepAlive: true, family: 4 } }
  }); 
  console.log("[bot.js] Bot nesnesi oluşturuldu (Bekleme Modu).");
}

// HTML Karakterlerini Temizleme
const escape = (str) => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- SPAM KONTROL ---
const checkSpam = (userId) => {
    const currentTime = Date.now();
    if (userCooldowns.has(userId)) {
        const lastTime = userCooldowns.get(userId);
        if ((currentTime - lastTime) / 1000 < SPAM_LIMIT_SECONDS) return true;
    }
    userCooldowns.set(userId, currentTime);
    return false;
};

// --- FUD KONTROLÜ (Gelişmiş) ---
const isFud = (text) => {
    const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, "");
    const fudWords = ["scam", "rug", "honeypot", "fake", "cantdraining", "slowrug", "cantdrain"];
    return fudWords.some(w => normalized.includes(w));
};

// --- RANK SİSTEMİ: XP GÜNCELLEME ---
const updateRank = async (userId, firstName, username) => {
    try {
        const displayName = username || firstName || 'User';
        await pool.query(`
            INSERT INTO user_ranks (user_id, username, xp, level) 
            VALUES ($1, $2, 1, 'Cadet') 
            ON CONFLICT (user_id) DO UPDATE 
            SET xp = user_ranks.xp + 1, username = $2
        `, [userId, displayName]);

        const res = await pool.query('SELECT xp FROM user_ranks WHERE user_id = $1', [userId]);
        const xp = res.rows[0]?.xp || 0;
        
        let newLevel = 'Cadet';
        if (xp > 50) newLevel = 'Pilot ✈️';
        if (xp > 200) newLevel = 'Sky Commander 🦅';
        if (xp > 500) newLevel = 'Legend 🌟';
        if (xp > 1000) newLevel = 'Sky God ⚡';

        await pool.query('UPDATE user_ranks SET level = $1 WHERE user_id = $2', [newLevel, userId]);
    } catch (e) { 
        console.error("Rank Update Error:", e.message); 
    }
};

// ====================================================
//       AKILLI BAŞLATMA (WEBHOOK vs POLLING)
// ====================================================
export const startTelegramBot = async () => {
    if (!bot) return;
    
    try {
        // Önce eski webhook veya polling çakışmalarını temizle
        await bot.deleteWebHook();
        console.log("[bot.js] Webhook temizlendi.");

        // Eğer RENDER üzerindeysek (Canlı Sunucu) -> WEBHOOK KULLAN
        if (RENDER_URL) {
            const webhookUrl = `${RENDER_URL}/bot${TOKEN}`;
            console.log(`[bot.js] 🌍 PRODUCTION MODU: Webhook ayarlanıyor...`);
            console.log(`[bot.js] Hedef URL: ${webhookUrl}`);
            
            await bot.setWebHook(webhookUrl);
            console.log("[bot.js] ✅ Webhook başarıyla kuruldu. 409 Hatası Bitti.");
        } 
        // Eğer LOCAL üzerindeysek (Kendi Bilgisayarın) -> POLLING KULLAN
        else {
            console.log("[bot.js] 💻 LOCAL MOD: Polling başlatılıyor...");
            await bot.startPolling();
            console.log("[bot.js] ✅ Polling aktif.");
        }

    } catch (error) {
        console.error("[bot.js] Başlatma Hatası:", error.message);
    }
};

// ====================================================
//           KOMUTLAR VE MANTIK
// ====================================================
if (bot) {
    
    // 1. /help
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

    // 2. /stats (Axios ile Güvenli)
    bot.onText(/\/stats/, async (msg) => {
        if (checkSpam(msg.from.id)) return;
        const chatId = msg.chat.id;
        const pairAddress = process.env.PANCAKESWAP_PAIR_ADDRESS;

        try {
            let pair = null;
            if (pairAddress) {
                const res1 = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/bsc/${pairAddress}`);
                if (res1.data.pairs && res1.data.pairs[0]) pair = res1.data.pairs[0];
            }
            if (!pair) {
                const res2 = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CA}`);
                if (res2.data.pairs && res2.data.pairs[0]) pair = res2.data.pairs[0];
            }

            if (!pair) {
                return bot.sendMessage(chatId, "⚠️ *Data Syncing:* Please try again in a few minutes.", { parse_mode: 'Markdown' });
            }

            const price = pair.priceUsd || '0';
            const liquidity = pair.liquidity?.usd ? pair.liquidity.usd.toLocaleString() : '0';
            const fdv = pair.fdv ? pair.fdv.toLocaleString() : '0';
            const change = pair.priceChange?.h24 || '0';
            const volume = pair.volume?.h24 ? pair.volume.h24.toLocaleString() : '0';

            const statsMsg = `
📊 *Skyline Logic ($SKYL) Live Stats*

💰 *Price:* $${price}
💧 *Liquidity:* $${liquidity}
🦅 *FDV:* $${fdv}
📉 *24h Change:* ${change}%
🔄 *Volume (24h):* $${volume}

🔗 [View on DexScreener](${pair.url})
            `;
            bot.sendMessage(chatId, statsMsg, { parse_mode: 'Markdown', disable_web_page_preview: true });

        } catch (e) {
            console.error("Stats API Error:", e.message);
            bot.sendMessage(chatId, "⚠️ Market data currently unavailable.");
        }
    });

    // 3. /rank
    bot.onText(/\/rank/, async (msg) => {
        if (checkSpam(msg.from.id)) return;
        const userId = msg.from.id.toString();

        try {
            const res = await pool.query('SELECT * FROM user_ranks WHERE user_id = $1', [userId]);
            
            if (res.rows.length === 0) {
                await updateRank(userId, msg.from.first_name, msg.from.username);
                return bot.sendMessage(msg.chat.id, "🆕 Profile created! Type /rank again to see stats.");
            }
            
            const { xp, level } = res.rows[0];
            bot.sendMessage(msg.chat.id, `🎖 *Your Rank Card*\n\n👤 User: ${msg.from.first_name}\n🔰 Level: *${level}*\n✨ XP: *${xp}*`, { parse_mode: 'Markdown' });

        } catch (e) { 
            bot.sendMessage(msg.chat.id, "⚠️ Database syncing. Try again shortly."); 
        }
    });

    // 4. /ask (AI + Offline Fallback)
    bot.onText(/\/ask (.+)/, async (msg, match) => {
        if (checkSpam(msg.from.id)) return;
        const question = match[1];
        const chatId = msg.chat.id;

        if (openai) {
            bot.sendChatAction(chatId, 'typing');
            try {
                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: "You are Hyper Logic AI ($SKYL). Professional, futuristic, strict English. Concise answers." },
                        { role: "user", content: question }
                    ],
                    model: "gpt-4o-mini",
                });
                bot.sendMessage(chatId, completion.choices[0].message.content, { parse_mode: 'Markdown' });
            } catch (e) {
                handleOfflineAI(chatId, question);
            }
        } else {
            handleOfflineAI(chatId, question);
        }
    });

    const handleOfflineAI = (chatId, question) => {
        const lowerQ = question.toLowerCase();
        const knowledgeBase = [
            { keys: ["contract", "ca", "address"], answer: `💎 *Contract:* \`${TOKEN_CA}\`` },
            { keys: ["buy", "pancake", "swap"], answer: `🛒 *Buy here:* [PancakeSwap](${BUY_LINK})` },
            { keys: ["airdrop", "claim"], answer: `🎁 *Claim here:* ${AIRDROP_PAGE}` },
            { keys: ["tax", "slippage"], answer: `💸 *Tax:* 0% Buy / 0% Sell` },
            { keys: ["lock", "lp"], answer: `🔒 *Liquidity:* Locked for 5 Years.` },
            { keys: ["roadmap", "plan"], answer: `🗺 *Roadmap:* Launch → AI Dashboard → Staking → Tier 1 CEX.` }
        ];
        const found = knowledgeBase.find(item => item.keys.some(k => lowerQ.includes(k)));
        const resp = found ? found.answer : `🤖 AI Offline. Visit: ${WEBSITE}`;
        bot.sendMessage(chatId, resp, { parse_mode: 'Markdown' });
    };

    // 5. Temel Komutlar
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
        const message = `🌐 *Official Links*\n\n🌍 [Website](${WEBSITE})\n🐦 [X (Twitter)](https://x.com/SkylineLogicAI)\n✈️ [Telegram](https://t.me/SkylineLogicChat)`;
        bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown', disable_web_page_preview: true });
    });

    // 6. Admin: Raid (DM Korumalı)
    bot.onText(/\/raid (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (msg.chat.type === "private") return bot.sendMessage(chatId, "⚠️ Group only.");
        
        const url = match[1].trim();
        if (!url.includes("twitter.com") && !url.includes("x.com")) {
            return bot.sendMessage(chatId, "❌ Invalid raid link. Use Twitter/X.");
        }

        try {
            const member = await bot.getChatMember(chatId, msg.from.id);
            if (!['creator', 'administrator'].includes(member.status)) return;
            
            bot.deleteMessage(chatId, msg.message_id).catch(()=>{});
            await bot.sendPhoto(chatId, IMG_RAID, {
                caption: `🚨 *SKYLINE RAID ALERT*\n\n👇 *SMASH THIS TWEET* 👇`,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '⚔️ ATTACK NOW ⚔️', url }]] }
            });
        } catch (e) {}
    });

    // 7. Admin: Announce (DM Korumalı + Regex Fix)
    bot.onText(/\/announce(?:\s+([\s\S]+))?/, async (msg, match) => {
        const chatId = msg.chat.id;
        if (msg.chat.type === "private") return bot.sendMessage(chatId, "⚠️ Group only.");

        const content = match[1];
        if (!content) return bot.sendMessage(chatId, "⚠️ Usage: `/announce Your Message`", {parse_mode: 'Markdown'});

        try {
            const member = await bot.getChatMember(chatId, msg.from.id);
            if (!['creator', 'administrator'].includes(member.status)) return;

            bot.deleteMessage(chatId, msg.message_id).catch(()=>{});
            const announcement = `📢 *ANNOUNCEMENT*\n\n${content.trim()}\n\n🚀 *$SKYL Team*`;
            await bot.sendMessage(chatId, announcement, { parse_mode: 'Markdown' });
        } catch (e) {}
    });

    // 8. Mesaj Dinleyici (FUD + Rank)
    bot.on('message', async (msg) => {
        if (!msg.text || msg.text.startsWith('/') || msg.from.is_bot) return;
        await updateRank(msg.from.id.toString(), msg.from.first_name, msg.from.username);

        if (isFud(msg.text)) {
             bot.deleteMessage(msg.chat.id, msg.message_id).catch(()=>{});
             bot.sendMessage(msg.chat.id, "🚫 *Warning:* FUD is not tolerated.", { parse_mode: 'Markdown' });
        }
    });

    // 9. Hoş Geldin + Captcha (Güvenli Permissions)
    bot.on('new_chat_members', async (msg) => {
        const chatId = msg.chat.id;
        for (const member of msg.new_chat_members) {
            if (member.is_bot) continue;
            
            try { await bot.restrictChatMember(chatId, member.id, { permissions: { can_send_messages: false } }); } catch (e) {}

            const n1 = Math.floor(Math.random()*5)+1, n2 = Math.floor(Math.random()*5)+1;
            const ans = n1+n2;
            const opts = [
                { text: `${n1}+${n2}=${ans}`, callback_data: `cap|ok|${member.id}` },
                { text: `${n1}+${n2}=${ans+1}`, callback_data: `cap|no|${member.id}` }
            ].sort(()=>Math.random()-0.5);

            const sent = await bot.sendPhoto(chatId, IMG_WELCOME, {
                caption: `👋 *Welcome, ${member.first_name}!*\n\nProve you are human:\n*Solve:* ${n1} + ${n2} = ?`,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [opts] }
            });
            
            captchaPending.set(member.id.toString(), sent.message_id);
            setTimeout(()=>{ 
                const key = member.id.toString();
                if(captchaPending.has(key)) {
                    bot.deleteMessage(chatId, sent.message_id).catch(()=>{});
                    captchaPending.delete(key);
                }
            }, 60000);
        }
    });

    // 10. Captcha Doğrulama
    bot.on('callback_query', async (q) => {
        if (!q.data || !q.data.startsWith('cap')) return;
        const parts = q.data.split('|');
        const status = parts[1];
        const id = parts[2];

        if (String(q.from.id) !== String(id)) return bot.answerCallbackQuery(q.id, {text:"Not for you!", show_alert:true});

        if (status === 'ok') {
            try { await bot.restrictChatMember(q.message.chat.id, id, { permissions: { can_send_messages: true, can_send_media_messages: true, can_send_other_messages: true, can_add_web_page_previews: true } }); } catch(e){}
            await bot.answerCallbackQuery(q.id, {text:"Verified!"});
            bot.deleteMessage(q.message.chat.id, q.message.message_id).catch(()=>{});
            captchaPending.delete(id);
            bot.sendMessage(q.message.chat.id, `✅ Verified! Welcome, ${q.from.first_name}.`, { disable_notification: true });
        } else {
            bot.answerCallbackQuery(q.id, {text:"Wrong answer!", show_alert:true});
        }
    });

    // 11. Veda
    bot.on('left_chat_member', async (msg) => {
        const chatId = msg.chat.id;
        const leftMember = msg.left_chat_member;
        if (leftMember.is_bot) return;
        try { await bot.sendPhoto(chatId, IMG_GOODBYE, { caption: `👋 Goodbye, ${leftMember.first_name}.`, parse_mode: 'Markdown' }); } 
        catch (e) {}
    });
}

// ====================================================
//             BUY BOT BİLDİRİMLERİ
// ====================================================
export const sendBuyDetected = async (amountSKYL, costWBNB, wallet, txHash, imageURL) => {
  if (!bot || !CHAT_ID) return;
  const txt = `
$SKYL Buy Detected!
<b>Amount:</b> ${parseFloat(amountSKYL).toFixed(0)} $SKYL
<b>Cost:</b> ${parseFloat(costWBNB).toFixed(4)} BNB
<b>Wallet:</b> <code>${escape(wallet.slice(0,6)+'...'+wallet.slice(-4))}</code>
<a href="https://bscscan.com/tx/${escape(txHash)}">View on BscScan</a>`.trim();
  let finalImg = IMG_DEFAULT_BUY;
  if (imageURL && imageURL.startsWith("http")) finalImg = imageURL;
  try { await bot.sendPhoto(CHAT_ID, finalImg, { caption: txt, parse_mode: "HTML" }); } catch (e) {}
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

// SERVER.JS İÇİN DIŞA AKTAR (KRİTİK)
export default bot;
