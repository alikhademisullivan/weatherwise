import { Router, Request, Response } from 'express';
import * as openMeteo from '../services/openMeteo';
import * as openWeatherMap from '../services/openWeatherMap';
import * as tomorrowIo from '../services/tomorrowIo';
import * as weatherApi from '../services/weatherApi';
import { buildConsensus, mergeForecastDays } from '../services/consensus';
import { getCached, setCached, buildCacheKey } from '../cache/weatherCache';
import { getDynamicWeights, getAccuracyScores } from '../db/accuracy';
import { recordPrediction, getUniqueLocations } from '../db/predictions';
import { dbEnabled } from '../db/pool';
import type {
  WeatherResponse,
  ForecastResponse,
  HourlyForecastResponse,
  AccuracyResponse,
  SourceReading,
  ForecastDay,
} from '../types/weather';

const router = Router();

async function fetchAllCurrentSources(city: string): Promise<SourceReading[]> {
  const tasks: Promise<SourceReading>[] = [openMeteo.getCurrentWeather(city)];
  if (process.env.OPENWEATHERMAP_API_KEY) tasks.push(openWeatherMap.getCurrentWeather(city));
  if (process.env.TOMORROW_IO_API_KEY)    tasks.push(tomorrowIo.getCurrentWeather(city));
  if (process.env.WEATHERAPI_KEY)         tasks.push(weatherApi.getCurrentWeather(city));

  const results = await Promise.allSettled(tasks);
  const readings: SourceReading[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') readings.push(r.value);
    else console.warn('Source fetch failed:', r.reason?.message);
  }
  return readings;
}

async function fetchAllForecastSources(city: string, days: number): Promise<ForecastDay[][]> {
  const tasks: Promise<ForecastDay[]>[] = [openMeteo.getForecast(city, days)];
  if (process.env.OPENWEATHERMAP_API_KEY) tasks.push(openWeatherMap.getForecast(city, days));
  if (process.env.TOMORROW_IO_API_KEY)    tasks.push(tomorrowIo.getForecast(city, days));
  if (process.env.WEATHERAPI_KEY)         tasks.push(weatherApi.getForecast(city, days));

  const results = await Promise.allSettled(tasks);
  return results
    .filter((r): r is PromiseFulfilledResult<ForecastDay[]> => r.status === 'fulfilled')
    .map(r => r.value);
}

// Fire-and-forget: record each source's day+1 prediction into the DB
async function recordForecastPredictions(city: string, perSourceForecasts: ForecastDay[][]): Promise<void> {
  if (!dbEnabled()) return;
  try {
    // Resolve lat/lon once for this city
    const locations = await getUniqueLocations();
    const existing = locations.find(l => l.location === city.toLowerCase());

    // We need lat/lon — use Open-Meteo geocoding. Reuse cached if available.
    let lat: number, lon: number;
    if (existing) {
      lat = existing.latitude;
      lon = existing.longitude;
    } else {
      // Geocode via Open-Meteo (already done during the forecast fetch, but no shared cache here)
      // Use a lightweight approach: re-geocode and cache the result in DB via first prediction row
      const { data } = await (await import('axios')).default.get('https://geocoding-api.open-meteo.com/v1/search', {
        params: { name: city, count: 1, language: 'en', format: 'json' },
      });
      if (!data.results?.length) return;
      lat = data.results[0].latitude;
      lon = data.results[0].longitude;
    }

    // Tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const forDate = tomorrow.toISOString().split('T')[0];

    // Build source name list — same order as fetchAllForecastSources
    const sourceNames: string[] = ['Open-Meteo'];
    if (process.env.OPENWEATHERMAP_API_KEY) sourceNames.push('OpenWeatherMap');
    if (process.env.TOMORROW_IO_API_KEY)    sourceNames.push('Tomorrow.io');
    if (process.env.WEATHERAPI_KEY)         sourceNames.push('WeatherAPI');

    for (let i = 0; i < perSourceForecasts.length; i++) {
      const days = perSourceForecasts[i];
      const dayOne = days.find(d => d.date === forDate) ?? days[0];
      if (!dayOne) continue;

      await recordPrediction(
        sourceNames[i],
        city,
        lat,
        lon,
        dayOne.date,
        dayOne.high,
        dayOne.low,
        dayOne.condition,
      ).catch(() => {}); // never block the response
    }
  } catch (err) {
    console.warn('[Predictions] Failed to record:', (err as Error).message);
  }
}

// GET /api/weather/current?city=Toronto
router.get('/current', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const cacheKey = buildCacheKey(city, 'current');
  const cached = getCached<WeatherResponse>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const [readings, dynamicWeights] = await Promise.all([
      fetchAllCurrentSources(city),
      getDynamicWeights(city),
    ]);
    if (!readings.length) return res.status(502).json({ error: 'All weather sources failed' });

    const consensus = buildConsensus(readings, city, dynamicWeights);
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

    // Record predictions for accuracy tracking (non-blocking)
    recordForecastPredictions(city, perSource);

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

// GET /api/weather/hourly?city=Toronto
router.get('/hourly', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const cacheKey = buildCacheKey(city, 'hourly' as any);
  const cached = getCached<HourlyForecastResponse>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const hours = await openMeteo.getHourlyForecast(city);
    const response: HourlyForecastResponse = {
      location: city,
      hours,
      updatedAt: new Date().toISOString(),
    };
    setCached(cacheKey, response);
    return res.json(response);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// GET /api/weather/accuracy?city=Toronto
router.get('/accuracy', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const accuracyRows = await getAccuracyScores(city);
  const dynamicWeights = await getDynamicWeights(city);

  const sources = accuracyRows.map(r => ({
    source: r.source,
    mae: Number(r.mae),
    accuracyScore: Number(r.accuracy_score),
    sampleCount: r.sample_count,
    weight: dynamicWeights[r.source] ?? 1.0,
  }));

  const response: AccuracyResponse = {
    location: city,
    sources,
    usingDynamicWeights: sources.length > 0,
    updatedAt: new Date().toISOString(),
  };

  return res.json(response);
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

// GET /api/weather/geocode/reverse?lat=X&lon=Y
router.get('/geocode/reverse', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat and lon are required' });

  try {
    const city = await openMeteo.reverseGeocode(lat, lon);
    return res.json({ city, lat, lon });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
