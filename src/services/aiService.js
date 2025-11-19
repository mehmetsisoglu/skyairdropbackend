import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

const SYSTEM_PROMPT = `
Sen Skyline Logic ($SKYL) için 'Hyper Logic AI' finansal analistisin.
Görev: Kripto haber başlıklarını analiz et.

Çıktı Formatı (JSON):
{
  "analysis": [
    {
      "headline": "Haber Başlığı",
      "sentiment_score": (-100 ile +100 arası tamsayı),
      "risk_score": (0 ile 100 arası tamsayı),
      "summary": "Tek cümlelik Türkçe özet"
    }
  ]
}
`;

export async function analyzeNewsBatch(newsList) {
  if (!newsList || newsList.length === 0) return null;

  try {
    const promptContent = newsList.map((n, i) => `${i+1}. [${n.source}] ${n.title}`).join('\n');

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Analiz et:\n${promptContent}` }
      ],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return result.analysis;

  } catch (error) {
    console.error('[AI Service] Hata:', error);
    return null;
  }
}