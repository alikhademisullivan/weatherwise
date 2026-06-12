import axios from 'axios';
import type { SourceReading, ForecastDay, HourlyReading } from '../types/weather';

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
  country_code: string;
}

async function geocode(city: string): Promise<GeoResult> {
  const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name: city, count: 1, language: 'en', format: 'json' },
  });
  if (!data.results?.length) throw new Error(`City not found: ${city}`);
  return data.results[0];
}

function wmoCodeToCondition(code: number): { condition: string; conditionCode: string } {
  if (code === 0) return { condition: 'Clear Sky', conditionCode: 'clear' };
  if (code <= 2) return { condition: 'Partly Cloudy', conditionCode: 'partly_cloudy' };
  if (code === 3) return { condition: 'Overcast', conditionCode: 'cloudy' };
  if (code <= 49) return { condition: 'Foggy', conditionCode: 'fog' };
  if (code <= 59) return { condition: 'Drizzle', conditionCode: 'drizzle' };
  if (code <= 69) return { condition: 'Rain', conditionCode: 'rain' };
  if (code <= 79) return { condition: 'Snow', conditionCode: 'snow' };
  if (code <= 82) return { condition: 'Rain Showers', conditionCode: 'rain_showers' };
  if (code <= 86) return { condition: 'Snow Showers', conditionCode: 'snow_showers' };
  if (code <= 99) return { condition: 'Thunderstorm', conditionCode: 'thunderstorm' };
  return { condition: 'Unknown', conditionCode: 'unknown' };
}

export async function getCurrentWeather(city: string): Promise<SourceReading> {
  const geo = await geocode(city);

  const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: geo.latitude,
      longitude: geo.longitude,
      current: [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'wind_speed_10m',
        'precipitation_probability',
        'weather_code',
      ].join(','),
      wind_speed_unit: 'kmh',
      timezone: 'auto',
    },
  });

  const c = data.current;
  const { condition, conditionCode } = wmoCodeToCondition(c.weather_code);

  return {
    source: 'Open-Meteo',
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    precipitationProbability: c.precipitation_probability ?? 0,
    condition,
    conditionCode,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getForecast(city: string, days: number = 7): Promise<ForecastDay[]> {
  const geo = await geocode(city);

  const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: geo.latitude,
      longitude: geo.longitude,
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'weather_code',
      ].join(','),
      forecast_days: days,
      wind_speed_unit: 'kmh',
      timezone: 'auto',
    },
  });

  const d = data.daily;
  return d.time.map((date: string, i: number) => {
    const { condition } = wmoCodeToCondition(d.weather_code[i]);
    return {
      date,
      high: d.temperature_2m_max[i],
      low: d.temperature_2m_min[i],
      spreadHigh: d.temperature_2m_max[i],
      spreadLow: d.temperature_2m_min[i],
      precipitationProbability: d.precipitation_probability_max[i] ?? 0,
      condition,
      isDisputed: false,
    } satisfies ForecastDay;
  });
}

export async function getHourlyForecast(city: string): Promise<HourlyReading[]> {
  const geo = await geocode(city);

  const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: geo.latitude,
      longitude: geo.longitude,
      hourly: [
        'temperature_2m',
        'precipitation_probability',
        'wind_speed_10m',
        'weather_code',
      ].join(','),
      forecast_days: 2,
      wind_speed_unit: 'kmh',
      timezone: 'auto',
    },
  });

  const h = data.hourly;
  const now = new Date();

  return h.time
    .map((time: string, i: number) => {
      const { condition, conditionCode } = wmoCodeToCondition(h.weather_code[i]);
      return {
        time,
        temperature: h.temperature_2m[i],
        precipitationProbability: h.precipitation_probability[i] ?? 0,
        windSpeed: h.wind_speed_10m[i],
        condition,
        conditionCode,
      } satisfies HourlyReading;
    })
    .filter((h: HourlyReading) => new Date(h.time) >= now)
    .slice(0, 24);
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: { lat, lon, format: 'json' },
    headers: { 'User-Agent': 'WeatherWise/1.0' },
  });
  return (
    data.address?.city ??
    data.address?.town ??
    data.address?.village ??
    data.address?.county ??
    data.display_name.split(',')[0]
  );
}
