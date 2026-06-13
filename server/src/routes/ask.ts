import { Router, Request, Response } from 'express';
import * as openMeteo from '../services/openMeteo';
import * as openWeatherMap from '../services/openWeatherMap';
import * as tomorrowIo from '../services/tomorrowIo';
import * as weatherApi from '../services/weatherApi';
import { buildConsensus, mergeForecastDays } from '../services/consensus';
import { getDynamicWeights } from '../db/accuracy';
import { dbEnabled } from '../db/pool';
import { askGroq } from '../services/groqDecision';
import type { ChatMessage } from '../services/groqDecision';
import type { SourceReading, ForecastDay } from '../types/weather';

const router = Router();

async function fetchSources(city: string): Promise<SourceReading[]> {
  const tasks: Promise<SourceReading>[] = [openMeteo.getCurrentWeather(city)];
  if (process.env.OPENWEATHERMAP_API_KEY) tasks.push(openWeatherMap.getCurrentWeather(city));
  if (process.env.TOMORROW_IO_API_KEY)    tasks.push(tomorrowIo.getCurrentWeather(city));
  if (process.env.WEATHERAPI_KEY)         tasks.push(weatherApi.getCurrentWeather(city));

  const results = await Promise.allSettled(tasks);
  return results
    .filter((r): r is PromiseFulfilledResult<SourceReading> => r.status === 'fulfilled')
    .map(r => r.value);
}

async function fetchForecastSources(city: string, days: number): Promise<ForecastDay[][]> {
  const tasks: Promise<ForecastDay[]>[] = [openMeteo.getForecast(city, days)];
  if (process.env.OPENWEATHERMAP_API_KEY) tasks.push(openWeatherMap.getForecast(city, days));
  if (process.env.TOMORROW_IO_API_KEY)    tasks.push(tomorrowIo.getForecast(city, days));
  if (process.env.WEATHERAPI_KEY)         tasks.push(weatherApi.getForecast(city, days));

  const results = await Promise.allSettled(tasks);
  return results
    .filter((r): r is PromiseFulfilledResult<ForecastDay[]> => r.status === 'fulfilled')
    .map(r => r.value);
}

// POST /api/weather/ask
// Body: { city: string, question: string, history?: ChatMessage[] }
router.post('/', async (req: Request, res: Response) => {
  const { city, question, history } = req.body as {
    city?: string;
    question?: string;
    history?: ChatMessage[];
  };

  if (!city || !question) {
    return res.status(400).json({ error: 'city and question are required' });
  }

  if (question.length > 300) {
    return res.status(400).json({ error: 'Question too long (max 300 characters)' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'AI service not configured' });
  }

  // Sanitize history: only allow valid roles and string content, cap at 8 entries
  const sanitizedHistory: ChatMessage[] = Array.isArray(history)
    ? history
        .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-8)
    : [];

  try {
    const [sourceReadings, perSourceForecasts] = await Promise.all([
      fetchSources(city),
      fetchForecastSources(city, 7),
    ]);

    const weights = dbEnabled() ? await getDynamicWeights(city) : undefined;
    const consensus = buildConsensus(sourceReadings, city, weights ?? undefined);
    const forecast = mergeForecastDays(perSourceForecasts);

    const answer = await askGroq(city, consensus, forecast, question, sanitizedHistory);
    res.json({ answer, city, question });
  } catch (err: any) {
    console.error('Gemini error:', err);
    if (err?.status === 429) {
      return res.status(429).json({ error: 'AI quota exceeded — try again in a few seconds.' });
    }
    if (err?.status === 404) {
      return res.status(503).json({ error: 'AI model unavailable — check GEMINI_API_KEY and model name.' });
    }
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

export default router;
