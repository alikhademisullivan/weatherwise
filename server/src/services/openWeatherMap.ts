import axios from 'axios';
import type { SourceReading, ForecastDay } from '../types/weather';

const BASE = 'https://api.openweathermap.org/data/2.5';

function owmCodeToCondition(id: number, icon: string): { condition: string; conditionCode: string } {
  const isDay = icon.endsWith('d');
  if (id === 800) return { condition: isDay ? 'Clear Sky' : 'Clear Night', conditionCode: 'clear' };
  if (id > 800) return { condition: 'Partly Cloudy', conditionCode: 'partly_cloudy' };
  if (id >= 700) return { condition: 'Fog / Haze', conditionCode: 'fog' };
  if (id >= 600) return { condition: 'Snow', conditionCode: 'snow' };
  if (id >= 500) return { condition: 'Rain', conditionCode: 'rain' };
  if (id >= 300) return { condition: 'Drizzle', conditionCode: 'drizzle' };
  if (id >= 200) return { condition: 'Thunderstorm', conditionCode: 'thunderstorm' };
  return { condition: 'Unknown', conditionCode: 'unknown' };
}

// OWM timestamps are UTC; apply the response's timezone offset before formatting
function formatSunTime(unixTs: number, tzOffsetSec: number): string {
  const localMs = (unixTs + tzOffsetSec) * 1000;
  return new Date(localMs).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

export async function getCurrentWeather(city: string, coords?: { lat: number; lon: number }): Promise<SourceReading> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHERMAP_API_KEY not set');

  const locParam = coords ? { lat: coords.lat, lon: coords.lon } : { q: city };
  const { data } = await axios.get(`${BASE}/weather`, {
    params: { ...locParam, appid: apiKey, units: 'metric' },
  });

  const { condition, conditionCode } = owmCodeToCondition(
    data.weather[0].id,
    data.weather[0].icon,
  );

  // OWM /weather has no POP field; derive a probability from condition code + observed rain
  const precipMm = data.rain?.['1h'] ?? data.snow?.['1h'] ?? 0;
  const id = data.weather[0].id;
  const precipProb = precipMm > 0
    ? 90
    : id < 300  // thunderstorm
    ? 85
    : id < 500  // drizzle
    ? 60
    : id < 600  // rain
    ? 75
    : id < 700  // snow
    ? 70
    : 0;

  return {
    source: 'OpenWeatherMap',
    temperature: data.main.temp,
    feelsLike: data.main.feels_like,
    humidity: data.main.humidity,
    windSpeed: data.wind.speed * 3.6,
    precipitationProbability: precipProb,
    condition,
    conditionCode,
    fetchedAt: new Date().toISOString(),
    pressure: data.main.pressure,
    visibility: data.visibility != null ? parseFloat((data.visibility / 1000).toFixed(1)) : undefined,
    windDirection: data.wind.deg,
    windGust: data.wind.gust != null ? parseFloat((data.wind.gust * 3.6).toFixed(1)) : undefined,
    cloudCover: data.clouds?.all,
    precipitationMm: precipMm,
    sunriseTime: data.sys?.sunrise ? formatSunTime(data.sys.sunrise, data.timezone ?? 0) : undefined,
    sunsetTime: data.sys?.sunset ? formatSunTime(data.sys.sunset, data.timezone ?? 0) : undefined,
  };
}

export async function getForecast(city: string, days: number = 7, coords?: { lat: number; lon: number }): Promise<ForecastDay[]> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHERMAP_API_KEY not set');

  const locParam = coords ? { lat: coords.lat, lon: coords.lon } : { q: city };
  const { data } = await axios.get(`${BASE}/forecast`, {
    params: { ...locParam, appid: apiKey, units: 'metric', cnt: days * 8 },
  });

  // OWM returns 3-hour intervals; bucket by date and take daily high/low
  const byDate: Record<string, { highs: number[]; lows: number[]; pops: number[]; codes: number[]; icons: string[]; gusts: number[]; precip: number[] }> = {};

  for (const item of data.list) {
    const date = item.dt_txt.split(' ')[0];
    if (!byDate[date]) byDate[date] = { highs: [], lows: [], pops: [], codes: [], icons: [], gusts: [], precip: [] };
    byDate[date].highs.push(item.main.temp_max);
    byDate[date].lows.push(item.main.temp_min);
    byDate[date].pops.push((item.pop ?? 0) * 100);
    byDate[date].codes.push(item.weather[0].id);
    byDate[date].icons.push(item.weather[0].icon);
    if (item.wind?.gust) byDate[date].gusts.push(item.wind.gust * 3.6);
    if (item.rain?.['3h']) byDate[date].precip.push(item.rain['3h']);
  }

  return Object.entries(byDate)
    .slice(0, days)
    .map(([date, v]) => {
      const midIdx = Math.floor(v.codes.length / 2);
      const { condition, conditionCode } = owmCodeToCondition(v.codes[midIdx], v.icons[midIdx]);
      return {
        date,
        high: Math.max(...v.highs),
        low: Math.min(...v.lows),
        spreadHigh: Math.max(...v.highs),
        spreadLow: Math.min(...v.lows),
        precipitationProbability: Math.round(v.pops.reduce((a, b) => a + b, 0) / v.pops.length),
        condition,
        conditionCode,
        isDisputed: false,
        windGustMax: v.gusts.length ? parseFloat(Math.max(...v.gusts).toFixed(1)) : undefined,
        precipMm: v.precip.length ? parseFloat(v.precip.reduce((a, b) => a + b, 0).toFixed(1)) : undefined,
      } satisfies ForecastDay;
    });
}
