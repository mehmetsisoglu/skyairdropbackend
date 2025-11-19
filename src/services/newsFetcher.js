import axios from 'axios';

export async function getLatestCryptoNews() {
  try {
    // CryptoCompare API (Ücretsiz ve Public)
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    const newsData = response.data.Data;
    
    // Son 5 haberi alalım
    const latestNews = newsData.slice(0, 5).map(item => ({
      title: item.title,
      source: item.source_info.name,
      url: item.url
    }));

    console.log(`[NewsFetcher] ${latestNews.length} yeni haber çekildi.`);
    return latestNews;

  } catch (error) {
    console.error('[NewsFetcher] Hata:', error.message);
    return [];
  }
}