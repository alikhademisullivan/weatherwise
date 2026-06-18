import { Router, Request, Response } from 'express';
import axios from 'axios';
import * as openMeteo from '../services/openMeteo';
import * as openWeatherMap from '../services/openWeatherMap';
import * as tomorrowIo from '../services/tomorrowIo';
import * as weatherApi from '../services/weatherApi';
import { buildConsensus, mergeForecastDays } from '../services/consensus';
import { getCached, setCached, buildCacheKey } from '../cache/weatherCache';
import { getDynamicWeights, getAccuracyScores } from '../db/accuracy';
import { recordPrediction, getUniqueLocations } from '../db/predictions';
import { recordFeedback, getFeedbackSummary, type FeedbackType } from '../db/feedback';
import { dbEnabled } from '../db/pool';
import type {
  WeatherResponse,
  ForecastResponse,
  HourlyForecastResponse,
  AccuracyResponse,
  AlertsResponse,
  SourceReading,
  ForecastDay,
} from '../types/weather';

const router = Router();

async function fetchAllCurrentSources(city: string, coords?: { lat: number; lon: number }): Promise<SourceReading[]> {
  const named: Array<{ name: string; task: Promise<SourceReading> }> = [
    { name: 'Open-Meteo',      task: openMeteo.getCurrentWeather(city, coords) },
  ];
  if (process.env.OPENWEATHERMAP_API_KEY) named.push({ name: 'OpenWeatherMap', task: openWeatherMap.getCurrentWeather(city, coords) });
  if (process.env.TOMORROW_IO_API_KEY)    named.push({ name: 'Tomorrow.io',    task: tomorrowIo.getCurrentWeather(city, coords) });
  if (process.env.WEATHERAPI_KEY)         named.push({ name: 'WeatherAPI',      task: weatherApi.getCurrentWeather(city, coords) });

  const results = await Promise.allSettled(named.map(n => n.task));
  const readings: SourceReading[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') readings.push(r.value);
    else console.warn(`[weather] ${named[i].name} fetch failed:`, r.reason?.response?.status ?? r.reason?.message);
  }
  return readings;
}

async function fetchAllForecastSources(city: string, days: number, coords?: { lat: number; lon: number }): Promise<ForecastDay[][]> {
  const named: Array<{ name: string; task: Promise<ForecastDay[]> }> = [
    { name: 'Open-Meteo',      task: openMeteo.getForecast(city, days, coords) },
  ];
  if (process.env.OPENWEATHERMAP_API_KEY) named.push({ name: 'OpenWeatherMap', task: openWeatherMap.getForecast(city, days, coords) });
  if (process.env.TOMORROW_IO_API_KEY)    named.push({ name: 'Tomorrow.io',    task: tomorrowIo.getForecast(city, days, coords) });
  if (process.env.WEATHERAPI_KEY)         named.push({ name: 'WeatherAPI',      task: weatherApi.getForecast(city, days, coords) });

  const results = await Promise.allSettled(named.map(n => n.task));
  const forecasts: ForecastDay[][] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') forecasts.push(r.value);
    else console.warn(`[forecast] ${named[i].name} fetch failed:`, r.reason?.response?.status ?? r.reason?.message);
  }
  return forecasts;
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
      const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
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

// GET /api/weather/current?city=Toronto[&lat=X&lon=Y]
router.get('/current', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;
  const coords = lat !== undefined && lon !== undefined ? { lat, lon } : undefined;

  const cacheKey = coords ? `coords:${lat},${lon}:current` : buildCacheKey(city, 'current');
  const cached = getCached<WeatherResponse>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const [readings, dynamicWeights, resolvedCity] = await Promise.all([
      fetchAllCurrentSources(city, coords),
      getDynamicWeights(city),
      coords ? Promise.resolve(null) : openMeteo.resolveCity(city),
    ]);
    if (!readings.length) return res.status(502).json({ error: 'All weather sources failed' });

    const consensus = buildConsensus(readings, city, dynamicWeights);
    const response: WeatherResponse = {
      location: city,
      ...(resolvedCity ? { resolvedCity } : {}),
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

// GET /api/weather/forecast?city=Toronto&days=7[&lat=X&lon=Y]
router.get('/forecast', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  const days = Math.min(parseInt(req.query.days as string ?? '7', 10), 14);
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;
  const coords = lat !== undefined && lon !== undefined ? { lat, lon } : undefined;

  const cacheKey = coords ? `coords:${lat},${lon}:forecast:${days}` : buildCacheKey(city, `forecast-${days}` as any);
  const cached = getCached<ForecastResponse>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const perSource = await fetchAllForecastSources(city, days, coords);
    if (!perSource.length) return res.status(502).json({ error: 'All forecast sources failed' });

    // Record predictions for accuracy tracking (non-blocking)
    recordForecastPredictions(city, perSource);

    const forecast = mergeForecastDays(perSource).slice(0, days);
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

// GET /api/weather/hourly?city=Toronto[&lat=X&lon=Y&days=2]
router.get('/hourly', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;
  const coords = lat !== undefined && lon !== undefined ? { lat, lon } : undefined;
  const days = Math.min(parseInt(req.query.days as string ?? '2', 10), 7);

  const cacheKey = coords ? `coords:${lat},${lon}:hourly:${days}` : buildCacheKey(city, `hourly-${days}` as any);
  const cached = getCached<HourlyForecastResponse>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    const hours = await openMeteo.getHourlyForecast(city, coords, days);
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

// GET /api/weather/alerts?city=Toronto[&lat=X&lon=Y]
router.get('/alerts', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;
  const coords = lat !== undefined && lon !== undefined ? { lat, lon } : undefined;

  const cacheKey = coords ? `coords:${lat},${lon}:alerts` : buildCacheKey(city, 'alerts' as any);
  const cached = getCached<AlertsResponse>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  const alerts = await weatherApi.getAlerts(city, coords);
  const response: AlertsResponse = {
    location: city,
    alerts,
    updatedAt: new Date().toISOString(),
  };
  setCached(cacheKey, response);
  return res.json(response);
});

// POST /api/weather/feedback
// Body: { city, lat?, lon?, type: FeedbackType }
router.post('/feedback', async (req: Request, res: Response) => {
  const { city, lat, lon, type } = req.body ?? {};
  const valid: FeedbackType[] = ['accurate', 'too_warm', 'too_cold', 'missed_rain', 'false_rain'];
  if (!city || !type || !valid.includes(type)) {
    return res.status(400).json({ error: 'city and valid type required' });
  }
  await recordFeedback(city, lat ?? null, lon ?? null, type as FeedbackType);
  return res.json({ ok: true });
});

// GET /api/weather/feedback-summary?city=Toronto
router.get('/feedback-summary', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });
  const summary = await getFeedbackSummary(city);
  return res.json({ city, ...summary });
});

// GET /api/weather/precipitation-timeline?city=Toronto[&lat=X&lon=Y]
// Returns minute-by-minute precip for the next 60 min (Tomorrow.io) or hourly fallback (Open-Meteo)
router.get('/precipitation-timeline', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;
  const coords = lat !== undefined && lon !== undefined ? { lat, lon } : undefined;

  const cacheKey = coords ? `coords:${lat},${lon}:precip-timeline` : `${city.toLowerCase().trim()}:precip-timeline`;
  const cached = getCached<any>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  // Try Tomorrow.io minute-by-minute first; fall back to Open-Meteo hourly on rate-limit
  if (process.env.TOMORROW_IO_API_KEY) {
    try {
      const minutes = await tomorrowIo.getPrecipTimeline(city, coords);
      const response = { city, minutes, source: 'Tomorrow.io', updatedAt: new Date().toISOString() };
      setCached(cacheKey, response);
      return res.json(response);
    } catch (err: any) {
      if (err?.message === 'TOMORROW_RATE_LIMITED') {
        // Fall through to Open-Meteo hourly fallback below
        console.warn('[precip-timeline] Tomorrow.io rate limited — using Open-Meteo fallback');
      } else {
        console.warn('[precip-timeline] Tomorrow.io failed:', err?.message);
        // Also fall through to Open-Meteo
      }
    }
  }

  try {
    const hours = await openMeteo.getHourlyForecast(city, coords);
    const minutes = hours.map(h => ({
      time: h.time,
      precipProbability: h.precipitationProbability,
      precipIntensity: 0,
    }));

    const response = {
      city,
      minutes,
      source: 'Open-Meteo',
      fallback: true,
      message: 'Minute-by-minute data temporarily unavailable — showing hourly data instead.',
      updatedAt: new Date().toISOString(),
    };
    setCached(cacheKey, response);
    return res.json(response);
  } catch (err: any) {
    console.error('[precip-timeline]', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// GET /api/weather/historical?city=Toronto[&lat=X&lon=Y]
// Returns yesterday's actual high/low and last year's same-date high/low
router.get('/historical', async (req: Request, res: Response) => {
  const city = req.query.city as string;
  if (!city) return res.status(400).json({ error: 'city query param is required' });

  const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;

  const cacheKey = lat !== undefined && lon !== undefined
    ? `coords:${lat},${lon}:historical`
    : `${city.toLowerCase().trim()}:historical`;
  const cached = getCached<any>(cacheKey);
  if (cached) return res.json({ ...cached, cached: true });

  try {
    let geoLat: number, geoLon: number;
    if (lat !== undefined && lon !== undefined) {
      geoLat = lat; geoLon = lon;
    } else {
      const geoParts = city.split(',').map((s: string) => s.trim());
      const geoBase = geoParts[0];
      const geoHints = geoParts.slice(1).map((s: string) => s.toLowerCase());
      const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
        params: { name: geoBase, count: 5, language: 'en', format: 'json' },
      });
      if (!data.results?.length) return res.status(404).json({ error: 'City not found' });
      const bestResult = geoHints.length > 0
        ? (data.results.find((r: any) =>
            geoHints.some((h: string) =>
              r.country?.toLowerCase().includes(h) ||
              r.admin1?.toLowerCase().includes(h)
            )
          ) ?? data.results[0])
        : data.results[0];
      geoLat = bestResult.latitude;
      geoLon = bestResult.longitude;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const lastYear = new Date(yesterday);
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    const lastYearStr = lastYear.toISOString().split('T')[0];

    const [yesterdayData, lastYearData] = await Promise.all([
      openMeteo.getHistoricalDay(geoLat, geoLon, yesterdayStr),
      openMeteo.getHistoricalDay(geoLat, geoLon, lastYearStr),
    ]);

    const response = {
      city,
      yesterdayDate: yesterdayStr,
      lastYearDate: lastYearStr,
      yesterday: yesterdayData,
      lastYear: lastYearData,
      updatedAt: new Date().toISOString(),
    };

    setCached(cacheKey, response);
    return res.json(response);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
});

// POST /api/weather/ai-feedback
// Body: { city, question, answer, rating: 'up' | 'down' }
router.post('/ai-feedback', (req: Request, res: Response) => {
  const { city, question, answer, rating } = req.body ?? {};
  if (!city || !rating || !['up', 'down'].includes(rating)) {
    return res.status(400).json({ error: 'city and rating (up/down) required' });
  }
  console.log(`[AI Feedback] ${rating} — ${city}: "${question?.slice(0, 60)}"`);
  return res.json({ ok: true });
});

// POST /api/weather/user-feedback
// Body: { rating, category, comment?, email? }
router.post('/user-feedback', async (req: Request, res: Response) => {
  const { rating, category, comment, email } = req.body ?? {};
  const validCategories = ['bug', 'feature', 'general', 'compliment'];
  if (!rating || rating < 1 || rating > 5 || !category || !validCategories.includes(category)) {
    return res.status(400).json({ error: 'rating (1–5) and valid category required' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid email' });
  }
  try {
    const { recordUserFeedback } = await import('../db/userFeedback');
    await recordUserFeedback({ rating, category, comment: comment?.slice(0, 2000) ?? null, email: email?.trim().toLowerCase() ?? null });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/weather/digest/subscribe
// Body: { email, city }
router.post('/digest/subscribe', async (req: Request, res: Response) => {
  const { email, city } = req.body ?? {};
  if (!email || !city) return res.status(400).json({ error: 'email and city required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid email' });
  try {
    const { addSubscriber } = await import('../services/emailDigest');
    await addSubscriber(email.trim().toLowerCase(), city.trim());
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/weather/digest/unsubscribe
// Body: { email }
router.delete('/digest/unsubscribe', async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const { removeSubscriber } = await import('../services/emailDigest');
    await removeSubscriber(email.trim().toLowerCase());
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/weather/geocode/search?q=Toronto
router.get('/geocode/search', async (req: Request, res: Response) => {
  const q = ((req.query.q as string) ?? '').trim();
  if (q.length < 2) return res.json({ results: [] });

  try {
    const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: { name: q, count: 6, language: 'en', format: 'json' },
    });
    const results = (data.results ?? []).map((r: any) => ({
      label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      city: r.name,
      lat: r.latitude,
      lon: r.longitude,
    }));
    return res.json({ results });
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
