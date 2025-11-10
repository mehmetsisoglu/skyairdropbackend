// Skyline Logic Telegram Bot Bildiricisi
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

// Gizli anahtarları .env'den (veya Render Ortam Değişkenlerinden) oku
const TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Bu satırı da eklemeyi unutmayın
const CHAT_ID = process.env.TELEGRAM_CHANNEL_ID;

let bot;

// Sadece token ve chat ID varsa bot'u başlat
if (!TOKEN || !CHAT_ID) {
  console.warn(
    "⚠️ UYARI: TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID ortam değişkenleri ayarlanmamış. Telegram bildirimleri devre dışı."
  );
} else {
  // 'polling: false' olarak ayarlandı, çünkü bot sadece mesaj göndermek için kullanılacak,
  // kullanıcılardan mesaj almak için değil.
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log("✅ Telegram botu bildirimler için hazır.");
}

/**
 * Bir airdrop claim işlemi başarılı olduğunda Telegram'a bildirim gönderir.
 * @param {object} options - Claim detayları
 * @param {string} options.wallet - Claim yapanın cüzdan adresi
 * @param {string} options.amount - Claim edilen miktar
 */
export const sendAirdropClaim = async ({ wallet, amount }) => {
  // Bot başlatılamadıysa (TOKEN eksikse) fonksiyondan çık
  if (!bot) {
    console.warn(
      "Telegram botu başlatılmadığı için /notify-claim mesajı gönderilemedi."
    );
    return;
  }

  // Telegram'a gönderilecek düz metin mesajı
  // (Markdown kullanmak karakter hatalarına neden olabilir, düz metin en güvenlisidir)
  const message = `
🎉 YENİ AIRDROP CLAIM! 🎉

Bir kullanıcı airdrop'unu başarıyla claim etti!

💰 Miktar: ${amount} $SKYL
👤 Cüzdan: ${wallet}
🔗 BSCScan: https://bscscan.com/address/${wallet}
`;

  try {
    // Mesajı belirtilen sohbet ID'sine (kanal/grup) gönder
    await bot.sendMessage(CHAT_ID, message);
    console.log("✅ Telegram claim bildirimi başarıyla gönderildi.");
  } catch (error) {
    console.error("❌ Telegram'a mesaj gönderirken hata:", error.message);
  }
};