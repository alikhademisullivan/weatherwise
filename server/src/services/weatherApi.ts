import axios from 'axios';
import type { SourceReading, ForecastDay, WeatherAlert } from '../types/weather';

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

// US EPA index 1–6 → category
function epaIndexToCategory(idx: number): string {
  if (idx <= 1) return 'Good';
  if (idx <= 2) return 'Moderate';
  if (idx <= 3) return 'Unhealthy for Sensitive Groups';
  if (idx <= 4) return 'Unhealthy';
  if (idx <= 5) return 'Very Unhealthy';
  return 'Hazardous';
}

export async function getCurrentWeather(city: string): Promise<SourceReading> {
  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) throw new Error('WEATHERAPI_KEY not set');

  // Use forecast.json so we get astronomy (sunrise/sunset) in one call
  const { data } = await axios.get(`${BASE}/forecast.json`, {
    params: { key: apiKey, q: city, days: 1, aqi: 'yes', alerts: 'no' },
  });

  const c = data.current;
  const astro = data.forecast?.forecastday?.[0]?.astro;
  const dayData = data.forecast?.forecastday?.[0]?.day;

  const epaIdx = c.air_quality?.['us-epa-index'];

  return {
    source: 'WeatherAPI',
    temperature: c.temp_c,
    feelsLike: c.feelslike_c,
    humidity: c.humidity,
    windSpeed: c.wind_kph,
    // Fix: use daily_chance_of_rain from the day object rather than cloud coverage
    precipitationProbability: dayData?.daily_chance_of_rain ?? 0,
    condition: c.condition.text,
    conditionCode: wapiConditionToCode(c.condition.text),
    fetchedAt: new Date().toISOString(),
    pressure: c.pressure_mb,
    dewPoint: c.dewpoint_c,
    visibility: c.vis_km,
    windDirection: c.wind_degree,
    windGust: c.gust_kph,
    cloudCover: c.cloud,
    uvIndex: c.uv,
    precipitationMm: c.precip_mm,
    sunriseTime: astro?.sunrise,
    sunsetTime: astro?.sunset,
    airQualityIndex: epaIdx,
    airQualityCategory: epaIdx != null ? epaIndexToCategory(epaIdx) : undefined,
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
      conditionCode: wapiConditionToCode(day.condition.text),
      isDisputed: false,
      uvIndexMax: day.uv,
      precipMm: day.totalprecip_mm,
      windGustMax: day.maxwind_kph,
      sunriseTime: d.astro?.sunrise,
      sunsetTime: d.astro?.sunset,
      snowfallMm: day.totalsnow_cm != null ? day.totalsnow_cm * 10 : undefined,
    } satisfies ForecastDay;
  });
}

export async function getAlerts(city: string): Promise<WeatherAlert[]> {
  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) return [];

  try {
    const { data } = await axios.get(`${BASE}/forecast.json`, {
      params: { key: apiKey, q: city, days: 1, aqi: 'no', alerts: 'yes' },
    });

    const raw = data.alerts?.alert ?? [];
    return raw.map((a: any): WeatherAlert => ({
      headline: a.headline ?? a.event ?? 'Weather Alert',
      event: a.event ?? 'Alert',
      severity: normalizeSeverity(a.severity),
      urgency: a.urgency ?? 'Unknown',
      effective: a.effective ?? '',
      expires: a.expires ?? '',
      description: a.desc ?? a.instruction ?? '',
    }));
  } catch {
    return [];
  }
}

function normalizeSeverity(raw: string): WeatherAlert['severity'] {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('extreme')) return 'Extreme';
  if (s.includes('severe')) return 'Severe';
  if (s.includes('moderate')) return 'Moderate';
  return 'Minor';
}
