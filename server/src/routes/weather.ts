import { Router, Request, Response } from 'express';
import * as openMeteo from '../services/openMeteo';
import * as openWeatherMap from '../services/openWeatherMap';
import { buildConsensus, mergeForecastDays } from '../services/consensus';
import { getCached, setCached, buildCacheKey } from '../cache/weatherCache';
import type { WeatherResponse, ForecastResponse, SourceReading, ForecastDay } from '../types/weather';

const router = Router();

async function fetchAllCurrentSources(city: string): Promise<SourceReading[]> {
  const results = await Promise.allSettled([
    openMeteo.getCurrentWeather(city),
    ...(process.env.OPENWEATHERMAP_API_KEY
      ? [openWeatherMap.getCurrentWeather(city)]
      : []),
  ]);

  const readings: SourceReading[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') readings.push(r.value);
    else console.warn('Source fetch failed:', r.reason?.message);
  }
  return readings;
}

async function fetchAllForecastSources(city: string, days: number): Promise<ForecastDay[][]> {
  const results = await Promise.allSettled([
    openMeteo.getForecast(city, days),
    ...(process.env.OPENWEATHERMAP_API_KEY
      ? [openWeatherMap.getForecast(city, days)]
      : []),
  ]);

  return results
    .filter((r): r is PromiseFulfilledResult<ForecastDay[]> => r.status === 'fulfilled')
    .map(r => r.value);
}

// GET /api/weather/current?city=Toronto
router.get('/current', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const cacheKey = buildCacheKey(city, 'current');
  const cached = getCached<WeatherResponse>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const readings = await fetchAllCurrentSources(city);
    if (!readings.length) return res.status(502).json({ error: 'All weather sources failed' });

    const consensus = buildConsensus(readings, city);
    const response: WeatherResponse = {
      location: city,
      consensus,
      sources: readings,
      updatedAt: new Date().toISOString(),
    };

    setCached(cacheKey, response);
    return res.json(response);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// GET /api/weather/forecast?city=Toronto&days=7
router.get('/forecast', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  const days = Math.min(parseInt(req.query.days as string ?? '7', 10), 7);
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const cacheKey = buildCacheKey(city, 'forecast');
  const cached = getCached<ForecastResponse>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const perSource = await fetchAllForecastSources(city, days);
    if (!perSource.length) return res.status(502).json({ error: 'All forecast sources failed' });

    const forecast = mergeForecastDays(perSource);
    const response: ForecastResponse = {
      location: city,
      forecast,
      updatedAt: new Date().toISOString(),
    };

    setCached(cacheKey, response);
    return res.json(response);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// GET /api/weather/sources?city=Toronto
router.get('/sources', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  try {
    const readings = await fetchAllCurrentSources(city);
    return res.json({ location: city, sources: readings, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
