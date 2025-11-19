// src/services/newsFetcher.js (Multi-Source Edition)
import axios from 'axios';
import Parser from 'rss-parser';

const parser = new Parser();

// --- 1. KAYNAK: CryptoCompare (Mevcut) ---
async function fetchCryptoCompare() {
  try {
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    const data = response.data.Data || [];
    return data.slice(0, 3).map(item => ({
      title: item.title,
      source: 'CryptoCompare',
      url: item.url
    }));
  } catch (err) {
    console.error('[News] CryptoCompare Hatası:', err.message);
    return [];
  }
}

// --- 2. KAYNAK: CoinDesk (RSS) ---
async function fetchCoinDesk() {
  try {
    const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
    return feed.items.slice(0, 3).map(item => ({
      title: item.title,
      source: 'CoinDesk',
      url: item.link
    }));
  } catch (err) {
    // RSS bazen geçici olarak ulaşılamaz olabilir, sessizce geç
    return [];
  }
}

// --- 3. KAYNAK: CoinStats (API) ---
async function fetchCoinStats() {
  try {
    const response = await axios.get('https://api.coinstats.app/public/v1/news/trending?skip=0&limit=3');
    const data = response.data.news || [];
    return data.map(item => ({
      title: item.title,
      source: item.source || 'CoinStats',
      url: item.link
    }));
  } catch (err) {
    console.error('[News] CoinStats Hatası:', err.message);
    return [];
  }
}

// --- 4. KAYNAK: CryptoPanic (API/RSS Hibrit) ---
async function fetchCryptoPanic() {
  try {
    // API Key varsa API, yoksa RSS kullan
    const apiKey = process.env.CRYPTOPANIC_API_KEY;
    
    if (apiKey) {
      const response = await axios.get(`https://cryptopanic.com/api/v1/posts/?auth_token=${apiKey}&public=true`);
      const data = response.data.results || [];
      return data.slice(0, 3).map(item => ({
        title: item.title,
        source: 'CryptoPanic',
        url: item.url
      }));
    } else {
      const feed = await parser.parseURL('https://cryptopanic.com/news/rss/');
      return feed.items.slice(0, 3).map(item => ({
        title: item.title,
        source: 'CryptoPanic',
        url: item.link
      }));
    }
  } catch (err) {
    return [];
  }
}

// --- 5. KAYNAK: Binance (RSS) ---
async function fetchBinance() {
  try {
    const feed = await parser.parseURL('https://www.binance.com/en/feed/rss'); 
    return feed.items.slice(0, 2).map(item => ({
      title: item.title,
      source: 'Binance',
      url: item.link
    }));
  } catch (err) {
    return [];
  }
}

// === ANA FONKSİYON: HEPSİNİ TOPLA ===
export async function getLatestCryptoNews() {
  console.log('🌍 Global Haber Ağları Taranıyor...');

  // Tüm kaynaklara paralel istek at (Biri bozuksa diğeri çalışır)
  const results = await Promise.allSettled([
    fetchCryptoCompare(),
    fetchCoinDesk(),
    fetchCoinStats(),
    fetchCryptoPanic(),
    fetchBinance()
  ]);

  // Gelen verileri tek listede birleştir
  let allNews = [];
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      allNews = [...allNews, ...result.value];
    }
  });

  // Haberleri karıştır (Shuffle) - Hep aynı site en üstte çıkmasın
  allNews = allNews.sort(() => Math.random() - 0.5);

  // En fazla 12 haber seç (AI limitini zorlamamak için)
  const finalNews = allNews.slice(0, 12);

  console.log(`✅ Toplam ${finalNews.length} global haber analiz için hazırlandı.`);
  return finalNews;
}
