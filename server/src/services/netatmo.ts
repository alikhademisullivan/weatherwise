import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { dbEnabled, query, queryOne } from '../db/pool';
import type { LocalSensorReading } from '../types/weather';

const TOKEN_URL = 'https://api.netatmo.com/oauth2/token';
const API_URL = 'https://api.netatmo.com/api/getpublicdata';
const TOKEN_FILE = path.join(process.cwd(), 'data', 'netatmo_tokens.json');

// Readings older than 30 minutes are considered stale
const STALE_THRESHOLD_S = 30 * 60;
// Maximum stations to consider after nearest-N sort
const MAX_STATIONS = 10;
// Temperature outlier threshold — stations more than this many °C from the
// median of their neighbours are dropped before averaging
const OUTLIER_THRESHOLD_C = 5;

interface CachedToken {
  accessToken: string;
  expiresAt: number; // ms since epoch
  refreshToken: string;
}

let tokenCache: CachedToken | null = null;

async function loadTokens(): Promise<void> {
  // Prefer DB when available (persists across restarts/redeploys on Render)
  if (dbEnabled()) {
    try {
      const row = await queryOne<{ access_token: string; refresh_token: string; expires_at: string }>(
        'SELECT access_token, refresh_token, expires_at FROM netatmo_tokens WHERE id = 1',
      );
      if (row) {
        tokenCache = {
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          expiresAt: Number(row.expires_at),
        };
        return;
      }
    } catch {
      // DB not ready yet — fall through to file
    }
  }

  // Local dev fallback: JSON file
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      tokenCache = {
        accessToken: saved.access_token ?? '',
        expiresAt: saved.expires_at ?? 0,
        refreshToken: saved.refresh_token ?? '',
      };
    }
  } catch {
    // Missing or corrupt — will re-auth on next request
  }
}

async function saveTokens(cache: CachedToken): Promise<void> {
  if (dbEnabled()) {
    try {
      await query(
        `INSERT INTO netatmo_tokens (id, access_token, refresh_token, expires_at, updated_at)
         VALUES (1, $1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE
           SET access_token  = EXCLUDED.access_token,
               refresh_token = EXCLUDED.refresh_token,
               expires_at    = EXCLUDED.expires_at,
               updated_at    = NOW()`,
        [cache.accessToken, cache.refreshToken, cache.expiresAt],
      );
      return;
    } catch {
      // Fall through to file
    }
  }

  try {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({
      access_token: cache.accessToken,
      refresh_token: cache.refreshToken,
      expires_at: cache.expiresAt,
    }, null, 2));
  } catch {
    // Non-fatal — tokens still live in memory for this session
  }
}

// Load persisted tokens on module init (async — errors are non-fatal)
loadTokens().catch(() => {});

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  const BUFFER_MS = 5 * 60 * 1000;

  if (tokenCache && tokenCache.expiresAt > now + BUFFER_MS) {
    return tokenCache.accessToken;
  }

  // Re-read persisted tokens in case OAuth completed after the server started
  if (!tokenCache?.refreshToken) await loadTokens();

  const activeRefresh = tokenCache?.refreshToken || process.env.NETATMO_REFRESH_TOKEN;
  if (!activeRefresh) {
    throw new Error(
      'Netatmo not authenticated. Visit http://localhost:3001/api/netatmo/connect to authorize.',
    );
  }

  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', activeRefresh);
  params.set('client_id', process.env.NETATMO_CLIENT_ID ?? '');
  params.set('client_secret', process.env.NETATMO_CLIENT_SECRET ?? '');

  let data: any;
  try {
    ({ data } = await axios.post(TOKEN_URL, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }));
  } catch (err: any) {
    const body = err.response?.data;
    throw new Error(
      `Netatmo token refresh failed (${err.response?.status ?? 'network'}): ` +
      (body?.error_description ?? body?.error ?? err.message),
    );
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
    refreshToken: data.refresh_token ?? activeRefresh,
  };

  await saveTokens(tokenCache);
  return tokenCache.accessToken;
}

interface ParsedStation {
  lat: number;
  lon: number;
  temperature: number;
  humidity: number | null;
  pressure: number | null;
  rain1h: number | null;
  rainRateMmhr: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  lastMeasureAt: number; // unix seconds
}

// Netatmo measure objects come in two shapes:
//   Typed readings:  { res: { "<ts>": [v1, v2, ...] }, type: ["temperature", "humidity"] }
//   Direct readings: { rain_60min, rain_live, wind_strength, ... }
function parseStation(raw: any): ParsedStation | null {
  const loc = raw.place?.location;
  if (!Array.isArray(loc) || loc.length < 2) return null;

  // Netatmo returns [longitude, latitude]
  const [lon, lat] = loc as [number, number];

  let temperature: number | null = null;
  let humidity: number | null = null;
  let pressure: number | null = null;
  let rain1h: number | null = null;
  let rainRateMmhr: number | null = null;
  let windSpeed: number | null = null;
  let windDirection: number | null = null;
  let lastMeasureAt = 0;

  for (const measure of Object.values<any>(raw.measures ?? {})) {
    // Typed res object — outdoor module (temperature + humidity) and
    // indoor base station (pressure, CO2, etc.)
    if (measure.res && Array.isArray(measure.type)) {
      const timestamps = Object.keys(measure.res).map(Number);
      if (!timestamps.length) continue;
      const latestTs = Math.max(...timestamps);
      const values: number[] = measure.res[String(latestTs)] ?? [];
      if (latestTs > lastMeasureAt) lastMeasureAt = latestTs;

      (measure.type as string[]).forEach((field, i) => {
        const val = values[i];
        if (val == null) return;
        if (field === 'temperature' && temperature === null) temperature = val;
        if (field === 'humidity'    && humidity === null)    humidity = val;
        if (field === 'pressure'    && pressure === null)    pressure = val;
      });
    }

    // Rain gauge module
    if (measure.rain_60min != null) {
      rain1h = measure.rain_60min;
      rainRateMmhr = measure.rain_live ?? null;
      if ((measure.rain_timeutc ?? 0) > lastMeasureAt) {
        lastMeasureAt = measure.rain_timeutc;
      }
    }

    // Wind gauge module
    if (measure.wind_strength != null) {
      windSpeed = measure.wind_strength;
      windDirection = measure.wind_angle ?? null;
      if ((measure.wind_timeutc ?? 0) > lastMeasureAt) {
        lastMeasureAt = measure.wind_timeutc;
      }
    }
  }

  if (temperature === null) return null;

  return {
    lat, lon,
    temperature, humidity, pressure,
    rain1h, rainRateMmhr,
    windSpeed, windDirection,
    lastMeasureAt,
  };
}

// Haversine distance in km
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Circular mean for wind direction (avoids 359°/1° averaging to 180°)
function circularMeanDeg(angles: number[]): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const sinSum = angles.reduce((s, a) => s + Math.sin(toRad(a)), 0);
  const cosSum = angles.reduce((s, a) => s + Math.cos(toRad(a)), 0);
  return Math.round((Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360);
}

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export async function getNearbyStations(
  lat: number,
  lon: number,
  radiusKm = 3,
): Promise<LocalSensorReading | null> {
  if (!process.env.NETATMO_CLIENT_ID || !process.env.NETATMO_CLIENT_SECRET) {
    return null;
  }

  const token = await getAccessToken();

  // Bounding box around the target coordinate
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));

  const { data } = await axios.get(API_URL, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      lat_ne: lat + latDelta,
      lon_ne: lon + lonDelta,
      lat_sw: lat - latDelta,
      lon_sw: lon - lonDelta,
      required_data: 'temperature',
      filter: true, // only stations with data in the last 30 min
    },
  });

  const nowSec = Date.now() / 1000;

  type StationWithDist = ParsedStation & { distKm: number };

  const stations: StationWithDist[] = ((data.body ?? []) as any[])
    .map((raw) => {
      const s = parseStation(raw);
      if (!s) return null;
      if (nowSec - s.lastMeasureAt > STALE_THRESHOLD_S) return null;
      return { ...s, distKm: distanceKm(lat, lon, s.lat, s.lon) };
    })
    .filter((s): s is StationWithDist => s !== null)
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, MAX_STATIONS);

  if (!stations.length) return null;

  // Drop temperature outliers when we have enough stations to judge
  const temps = stations.map((s) => s.temperature);
  const median = medianOf(temps);
  const pool =
    stations.length >= 3
      ? stations.filter((s) => Math.abs(s.temperature - median) <= OUTLIER_THRESHOLD_C)
      : stations;

  // Fall back to nearest 5 if filtering leaves too few
  const finalPool = pool.length >= 2 ? pool : stations.slice(0, 5);

  // --- Aggregate each field from stations that have it ---

  const tempAvg = parseFloat(avg(finalPool.map((s) => s.temperature)).toFixed(1));

  const humidPool = finalPool.filter((s) => s.humidity !== null);
  const humidity = humidPool.length
    ? Math.round(avg(humidPool.map((s) => s.humidity!)))
    : undefined;

  const pressurePool = finalPool.filter((s) => s.pressure !== null);
  const pressure = pressurePool.length
    ? parseFloat(avg(pressurePool.map((s) => s.pressure!)).toFixed(0))
    : undefined;

  const rainPool = finalPool.filter((s) => s.rain1h !== null);
  const rain1h = rainPool.length
    ? parseFloat(avg(rainPool.map((s) => s.rain1h!)).toFixed(1))
    : undefined;

  const rainRatePool = finalPool.filter((s) => s.rainRateMmhr !== null);
  const rainRateMmhr = rainRatePool.length
    ? parseFloat(avg(rainRatePool.map((s) => s.rainRateMmhr!)).toFixed(2))
    : undefined;

  const windPool = finalPool.filter((s) => s.windSpeed !== null);
  const windSpeed = windPool.length
    ? parseFloat(avg(windPool.map((s) => s.windSpeed!)).toFixed(1))
    : undefined;

  const windDirPool = windPool.filter((s) => s.windDirection !== null);
  const windDirection = windDirPool.length
    ? circularMeanDeg(windDirPool.map((s) => s.windDirection!))
    : undefined;

  return {
    stationCount: finalPool.length,
    nearestKm: parseFloat(finalPool[0].distKm.toFixed(2)),
    temperature: tempAvg,
    humidity,
    pressure,
    rain1h,
    rainRateMmhr,
    rainStationCount: rainPool.length || undefined,
    windSpeed,
    windDirection,
    fetchedAt: new Date().toISOString(),
  };
}
