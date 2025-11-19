// src/services/newsFetcher.js (Fixed: Crash Protection)
import axios from 'axios';

export async function getLatestCryptoNews() {
  try {
    // CryptoCompare API
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    
    // API Yanıtının yapısını kontrol et (Debugging için log)
    // console.log("API Yanıtı:", response.data); 

    const newsData = response.data.Data;

    // KRİTİK KONTROL: Gelen veri bir liste (Array) mi?
    if (!newsData || !Array.isArray(newsData)) {
      console.warn('[NewsFetcher] API geçerli bir haber listesi döndürmedi.');
      return []; // Boş liste dön, çökme!
    }
    
    // Güvenli şekilde ilk 5 haberi al
    const latestNews = newsData.slice(0, 5).map(item => ({
      title: item.title,
      source: item.source_info ? item.source_info.name : 'CryptoNews',
      url: item.url
    }));

    console.log(`[NewsFetcher] ${latestNews.length} yeni haber çekildi.`);
    return latestNews;

  } catch (error) {
    // Axios hata detayını daha temiz göster
    const errorMsg = error.response ? `API Statüsü: ${error.response.status}` : error.message;
    console.error(`[NewsFetcher] Haber çekme hatası: ${errorMsg}`);
    return []; // Hata olsa bile boş liste dön, sistemi durdurma
  }
}
