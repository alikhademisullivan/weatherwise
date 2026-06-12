import axios from 'axios';
import type { SourceReading, ForecastDay } from '../types/weather';

const BASE = 'https://api.tomorrow.io/v4/weather';

// Tomorrow.io uses Open-Meteo geocoding since it doesn't have its own free geocode
async function geocode(city: string): Promise<{ lat: number; lon: number; name: string }> {
  const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name: city, count: 1, language: 'en', format: 'json' },
  });
  if (!data.results?.length) throw new Error(`City not found: ${city}`);
  const r = data.results[0];
  return { lat: r.latitude, lon: r.longitude, name: r.name };
}

function tioCodeToCondition(code: number): { condition: string; conditionCode: string } {
  if (code === 1000) return { condition: 'Clear Sky', conditionCode: 'clear' };
  if ([1100, 1101].includes(code)) return { condition: 'Partly Cloudy', conditionCode: 'partly_cloudy' };
  if ([1001, 1102].includes(code)) return { condition: 'Overcast', conditionCode: 'cloudy' };
  if ([2000, 2100].includes(code)) return { condition: 'Foggy', conditionCode: 'fog' };
  if (code === 4000) return { condition: 'Drizzle', conditionCode: 'drizzle' };
  if ([4001, 4200, 4201].includes(code)) return { condition: 'Rain', conditionCode: 'rain' };
  if ([5000, 5001, 5100, 5101].includes(code)) return { condition: 'Snow', conditionCode: 'snow' };
  if ([6000, 6001, 6200, 6201].includes(code)) return { condition: 'Freezing Rain', conditionCode: 'rain' };
  if ([7000, 7101, 7102].includes(code)) return { condition: 'Ice Pellets', conditionCode: 'snow' };
  if (code === 8000) return { condition: 'Thunderstorm', conditionCode: 'thunderstorm' };
  return { condition: 'Unknown', conditionCode: 'unknown' };
}

export async function getCurrentWeather(city: string): Promise<SourceReading> {
  const apiKey = process.env.TOMORROW_IO_API_KEY;
  if (!apiKey) throw new Error('TOMORROW_IO_API_KEY not set');

  const geo = await geocode(city);

  const { data } = await axios.get(`${BASE}/realtime`, {
    params: { location: `${geo.lat},${geo.lon}`, apikey: apiKey, units: 'metric' },
  });

  const v = data.data.values;
  const { condition, conditionCode } = tioCodeToCondition(v.weatherCode);

  return {
    source: 'Tomorrow.io',
    temperature: v.temperature,
    feelsLike: v.temperatureApparent,
    humidity: v.humidity,
    windSpeed: parseFloat((v.windSpeed * 3.6).toFixed(1)),
    precipitationProbability: v.precipitationProbability ?? 0,
    condition,
    conditionCode,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getForecast(city: string, days: number = 7): Promise<ForecastDay[]> {
  const apiKey = process.env.TOMORROW_IO_API_KEY;
  if (!apiKey) throw new Error('TOMORROW_IO_API_KEY not set');

  const geo = await geocode(city);

  const { data } = await axios.get(`${BASE}/forecast`, {
    params: {
      location: `${geo.lat},${geo.lon}`,
      apikey: apiKey,
      units: 'metric',
      timesteps: '1d',
    },
  });

  return data.timelines.daily.slice(0, days).map((d: any) => {
    const v = d.values;
    const { condition } = tioCodeToCondition(v.weatherCodeMax ?? v.weatherCode);
    return {
      date: d.time.split('T')[0],
      high: v.temperatureMax,
      low: v.temperatureMin,
      spreadHigh: v.temperatureMax,
      spreadLow: v.temperatureMin,
      precipitationProbability: v.precipitationProbabilityAvg ?? 0,
      condition,
      isDisputed: false,
    } satisfies ForecastDay;
  });
}
