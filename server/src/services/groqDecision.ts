import Groq from 'groq-sdk';
import type { ConsensusReading, ForecastDay } from '../types/weather';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are WeatherWise AI, a helpful weather assistant built into a multi-source weather aggregator app.
Rules:
- Be conversational and concise — 2 to 4 sentences maximum
- Always mention if sources are in dispute or confidence is low
- Be practical and specific, not generic
- Never invent weather data — only reason from the context provided
- If asked about something outside the weather data, politely redirect`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildWeatherContext(city: string, consensus: ConsensusReading, forecast: ForecastDay[]): string {
  return `
## Current Weather — ${city}
- Temperature: ${consensus.temperature}°C (feels like ${consensus.feelsLike}°C)
- Humidity: ${consensus.humidity}%
- Wind: ${consensus.windSpeed} km/h
- Precipitation probability: ${consensus.precipitationProbability}%
- Condition: ${consensus.condition}
- Source confidence: ${consensus.confidenceScore}/100
- Sources disputed: ${consensus.isDisputed ? `YES — ${consensus.disputeMessage}` : 'No, sources agree'}
- Temperature spread across sources: ${consensus.spread}°C

## 7-Day Forecast
${forecast.map(d =>
  `${d.date}: High ${d.high}°C / Low ${d.low}°C | Precip: ${d.precipitationProbability}% | ${d.condition}${d.isDisputed ? ' (sources split)' : ''}`
).join('\n')}
`.trim();
}

export async function askGroq(
  city: string,
  consensus: ConsensusReading,
  forecast: ForecastDay[],
  userQuestion: string,
  history: ChatMessage[] = []
): Promise<string> {
  const context = buildWeatherContext(city, consensus, forecast);

  // Keep last 8 messages (4 pairs) to stay within token budget
  const recentHistory = history.slice(-8);

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 300,
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${context}` },
      ...recentHistory,
      { role: 'user', content: userQuestion },
    ],
  });

  return completion.choices[0].message.content ?? 'Sorry, I could not generate a response.';
}
