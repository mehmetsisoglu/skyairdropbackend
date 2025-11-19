import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

// DEĞİŞİKLİK BURADA: Türkçe talimatlar İngilizceye çevrildi.
const SYSTEM_PROMPT = `
You are 'Hyper Logic AI', the financial analyst for the Skyline Logic ($SKYL) ecosystem.
Task: Analyze the provided crypto news headlines.

Output Format (JSON):
{
  "analysis": [
    {
      "headline": "Original Headline",
      "sentiment_score": (Integer between -100 and +100),
      "risk_score": (Integer between 0 and 100),
      "summary": "One concise sentence summary in ENGLISH."
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
        { role: "user", content: `Analyze these:\n${promptContent}` }
      ],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return result.analysis;

  } catch (error) {
    console.error('[AI Service] Error:', error);
    return null;
  }
}
