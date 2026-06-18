import axios from 'axios';
import type { SourceReading, ForecastDay, HourlyReading } from '../types/weather';

function calculateMoonPhase(): string {
  const now = new Date();
  const knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
  const lunarCycleMs = 29.53058867 * 24 * 60 * 60 * 1000;
  const elapsed = ((now.getTime() - knownNewMoon.getTime()) % lunarCycleMs + lunarCycleMs) % lunarCycleMs;
  const dayAge = elapsed / (24 * 60 * 60 * 1000);
  if (dayAge < 1.5)  return 'New Moon';
  if (dayAge < 6.5)  return 'Waxing Crescent';
  if (dayAge < 8.5)  return 'First Quarter';
  if (dayAge < 13.5) return 'Waxing Gibbous';
  if (dayAge < 16.5) return 'Full Moon';
  if (dayAge < 21.5) return 'Waning Gibbous';
  if (dayAge < 23.5) return 'Last Quarter';
  if (dayAge < 28.5) return 'Waning Crescent';
  return 'New Moon';
}

interface GeoResult {
  latitude: number;
  longitude: number;
  name: string;
  country_code: string;
  country?: string;
  admin1?: string;
}

async function geocode(city: string): Promise<GeoResult> {
  // For "London, Ontario, Canada", search by just "London" with count:5,
  // then pick the result whose country/admin matches the extra parts.
  const parts = city.split(',').map(s => s.trim());
  const baseName = parts[0];
  const hints = parts.slice(1).map(s => s.toLowerCase());

  const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name: baseName, count: 5, language: 'en', format: 'json' },
  });
  if (!data.results?.length) throw new Error(`City not found: ${city}`);

  const best: GeoResult = hints.length > 0
    ? (data.results.find((r: GeoResult) =>
        hints.some(h =>
          r.country?.toLowerCase().includes(h) ||
          (r as any).admin1?.toLowerCase().includes(h)
        )
      ) ?? data.results[0])
    : data.results[0];

  return best;
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

function formatSunTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export async function getCurrentWeather(city: string, coords?: { lat: number; lon: number }): Promise<SourceReading> {
  const geo = coords ? { latitude: coords.lat, longitude: coords.lon } : await geocode(city);

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
        'pressure_msl',
        'uv_index',
        'dewpoint_2m',
        'visibility',
        'wind_direction_10m',
        'wind_gusts_10m',
        'cloud_cover',
        'precipitation',
      ].join(','),
      daily: 'sunrise,sunset',
      forecast_days: 1,
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
    pressure: c.pressure_msl,
    uvIndex: c.uv_index,
    dewPoint: c.dewpoint_2m,
    visibility: c.visibility != null ? parseFloat((c.visibility / 1000).toFixed(1)) : undefined,
    windDirection: c.wind_direction_10m,
    windGust: c.wind_gusts_10m,
    cloudCover: c.cloud_cover,
    precipitationMm: c.precipitation,
    sunriseTime: data.daily?.sunrise?.[0] ? formatSunTime(data.daily.sunrise[0]) : undefined,
    sunsetTime: data.daily?.sunset?.[0] ? formatSunTime(data.daily.sunset[0]) : undefined,
    moonPhase: calculateMoonPhase(),
  };
}

export async function getForecast(city: string, days: number = 7, coords?: { lat: number; lon: number }): Promise<ForecastDay[]> {
  const geo = coords ? { latitude: coords.lat, longitude: coords.lon } : await geocode(city);

  const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: geo.latitude,
      longitude: geo.longitude,
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'weather_code',
        'uv_index_max',
        'precipitation_sum',
        'wind_gusts_10m_max',
        'sunrise',
        'sunset',
        'snowfall_sum',
      ].join(','),
      forecast_days: days,
      wind_speed_unit: 'kmh',
      timezone: 'auto',
    },
  });

  const d = data.daily;
  return d.time.map((date: string, i: number) => {
    const { condition, conditionCode } = wmoCodeToCondition(d.weather_code[i]);
    return {
      date,
      high: d.temperature_2m_max[i],
      low: d.temperature_2m_min[i],
      spreadHigh: d.temperature_2m_max[i],
      spreadLow: d.temperature_2m_min[i],
      precipitationProbability: d.precipitation_probability_max[i] ?? 0,
      condition,
      conditionCode,
      isDisputed: false,
      uvIndexMax: d.uv_index_max?.[i],
      precipMm: d.precipitation_sum?.[i],
      windGustMax: d.wind_gusts_10m_max?.[i],
      sunriseTime: d.sunrise?.[i] ? formatSunTime(d.sunrise[i]) : undefined,
      sunsetTime: d.sunset?.[i] ? formatSunTime(d.sunset[i]) : undefined,
      snowfallMm: d.snowfall_sum?.[i],
    } satisfies ForecastDay;
  });
}

export async function getHourlyForecast(city: string, coords?: { lat: number; lon: number }, days = 2): Promise<HourlyReading[]> {
  const geo = coords ? { latitude: coords.lat, longitude: coords.lon } : await geocode(city);
  const forecastDays = Math.min(Math.max(days, 2), 7);

  const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: geo.latitude,
      longitude: geo.longitude,
      hourly: [
        'temperature_2m',
        'precipitation_probability',
        'wind_speed_10m',
        'weather_code',
        'pressure_msl',
      ].join(','),
      forecast_days: forecastDays,
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
        pressure: h.pressure_msl?.[i] ?? undefined,
      } satisfies HourlyReading;
    })
    .filter((h: HourlyReading) => new Date(h.time) >= now);
}

export async function getHistoricalDay(lat: number, lon: number, dateStr: string): Promise<{ high: number; low: number; condition: string } | null> {
  try {
    const { data } = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
      params: {
        latitude: lat,
        longitude: lon,
        start_date: dateStr,
        end_date: dateStr,
        daily: ['temperature_2m_max', 'temperature_2m_min', 'weather_code'].join(','),
        timezone: 'auto',
      },
    });

    const d = data.daily;
    if (!d?.time?.length) return null;

    const { condition } = wmoCodeToCondition(d.weather_code[0]);
    return { high: d.temperature_2m_max[0], low: d.temperature_2m_min[0], condition };
  } catch {
    return null;
  }
}

export async function getYesterdaysActual(lat: number, lon: number): Promise<{ high: number; low: number; condition: string } | null> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  try {
    const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lon,
        daily: ['temperature_2m_max', 'temperature_2m_min', 'weather_code'].join(','),
        past_days: 1,
        forecast_days: 0,
        timezone: 'auto',
      },
    });

    const d = data.daily;
    const idx = d.time.indexOf(dateStr);
    if (idx === -1) return null;

    const { condition } = wmoCodeToCondition(d.weather_code[idx]);
    return { high: d.temperature_2m_max[idx], low: d.temperature_2m_min[idx], condition };
  } catch {
    return null;
  }
}

export async function resolveCity(city: string): Promise<string | null> {
  try {
    const geo = await geocode(city);
    return [geo.name, geo.admin1, geo.country].filter(Boolean).join(', ');
  } catch {
    return null;
  }
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
