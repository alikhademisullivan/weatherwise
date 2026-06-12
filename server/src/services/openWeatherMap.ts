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

export async function getCurrentWeather(city: string): Promise<SourceReading> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHERMAP_API_KEY not set');

  const { data } = await axios.get(`${BASE}/weather`, {
    params: { q: city, appid: apiKey, units: 'metric' },
  });

  const { condition, conditionCode } = owmCodeToCondition(
    data.weather[0].id,
    data.weather[0].icon,
  );

  return {
    source: 'OpenWeatherMap',
    temperature: data.main.temp,
    feelsLike: data.main.feels_like,
    humidity: data.main.humidity,
    windSpeed: data.wind.speed * 3.6,
    precipitationProbability: data.clouds?.all ?? 0,
    condition,
    conditionCode,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getForecast(city: string, days: number = 7): Promise<ForecastDay[]> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) throw new Error('OPENWEATHERMAP_API_KEY not set');

  const { data } = await axios.get(`${BASE}/forecast`, {
    params: { q: city, appid: apiKey, units: 'metric', cnt: days * 8 },
  });

  // OWM returns 3-hour intervals; bucket by date and take daily high/low
  const byDate: Record<string, { highs: number[]; lows: number[]; pops: number[]; codes: number[]; icons: string[] }> = {};

  for (const item of data.list) {
    const date = item.dt_txt.split(' ')[0];
    if (!byDate[date]) byDate[date] = { highs: [], lows: [], pops: [], codes: [], icons: [] };
    byDate[date].highs.push(item.main.temp_max);
    byDate[date].lows.push(item.main.temp_min);
    byDate[date].pops.push((item.pop ?? 0) * 100);
    byDate[date].codes.push(item.weather[0].id);
    byDate[date].icons.push(item.weather[0].icon);
  }

  return Object.entries(byDate)
    .slice(0, days)
    .map(([date, v]) => {
      const { condition } = owmCodeToCondition(v.codes[Math.floor(v.codes.length / 2)], v.icons[Math.floor(v.icons.length / 2)]);
      return {
        date,
        high: Math.max(...v.highs),
        low: Math.min(...v.lows),
        spreadHigh: Math.max(...v.highs),
        spreadLow: Math.min(...v.lows),
        precipitationProbability: Math.round(v.pops.reduce((a, b) => a + b, 0) / v.pops.length),
        condition,
        isDisputed: false,
      } satisfies ForecastDay;
    });
}
