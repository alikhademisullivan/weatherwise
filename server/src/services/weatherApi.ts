import axios from 'axios';
import type { SourceReading, ForecastDay } from '../types/weather';

const BASE = 'https://api.weatherapi.com/v1';

function wapiConditionToCode(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('thunder')) return 'thunderstorm';
  if (t.includes('blizzard') || t.includes('snow') || t.includes('sleet') || t.includes('ice')) return 'snow';
  if (t.includes('drizzle') || t.includes('mist')) return 'drizzle';
  if (t.includes('rain') || t.includes('shower')) return 'rain';
  if (t.includes('fog') || t.includes('freezing fog')) return 'fog';
  if (t.includes('overcast') || t.includes('cloudy')) return 'cloudy';
  if (t.includes('partly') || t.includes('partly cloudy')) return 'partly_cloudy';
  if (t.includes('sunny') || t.includes('clear')) return 'clear';
  return 'partly_cloudy';
}

export async function getCurrentWeather(city: string): Promise<SourceReading> {
  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) throw new Error('WEATHERAPI_KEY not set');

  const { data } = await axios.get(`${BASE}/current.json`, {
    params: { key: apiKey, q: city, aqi: 'no' },
  });

  const c = data.current;
  return {
    source: 'WeatherAPI',
    temperature: c.temp_c,
    feelsLike: c.feelslike_c,
    humidity: c.humidity,
    windSpeed: c.wind_kph,
    precipitationProbability: c.cloud,
    condition: c.condition.text,
    conditionCode: wapiConditionToCode(c.condition.text),
    fetchedAt: new Date().toISOString(),
  };
}

export async function getForecast(city: string, days: number = 7): Promise<ForecastDay[]> {
  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) throw new Error('WEATHERAPI_KEY not set');

  // WeatherAPI free tier supports up to 3 days; clamp
  const clampedDays = Math.min(days, 3);

  const { data } = await axios.get(`${BASE}/forecast.json`, {
    params: { key: apiKey, q: city, days: clampedDays, aqi: 'no', alerts: 'no' },
  });

  return data.forecast.forecastday.map((d: any) => {
    const day = d.day;
    return {
      date: d.date,
      high: day.maxtemp_c,
      low: day.mintemp_c,
      spreadHigh: day.maxtemp_c,
      spreadLow: day.mintemp_c,
      precipitationProbability: day.daily_chance_of_rain ?? 0,
      condition: day.condition.text,
      isDisputed: false,
    } satisfies ForecastDay;
  });
}
