import axios from 'axios';
import type { SourceReading, ForecastDay, HourlyReading } from '../types/weather';

const BASE = 'https://api.pirateweather.net/forecast';

async function geocode(city: string): Promise<{ lat: number; lon: number }> {
  const parts = city.split(',').map(s => s.trim());
  const hints = parts.slice(1).map(s => s.toLowerCase());
  const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name: parts[0], count: 5, language: 'en', format: 'json' },
  });
  if (!data.results?.length) throw new Error(`City not found: ${city}`);
  const best = hints.length > 0
    ? (data.results.find((r: any) => hints.some((h: string) =>
        r.country?.toLowerCase().includes(h) || r.admin1?.toLowerCase().includes(h)
      )) ?? data.results[0])
    : data.results[0];
  return { lat: best.latitude, lon: best.longitude };
}

// Dark Sky / Pirate Weather icon strings → standard condition codes
function iconToCondition(icon: string): { condition: string; conditionCode: string } {
  switch (icon) {
    case 'clear-day':
    case 'clear-night':     return { condition: 'Clear Sky',      conditionCode: 'clear' };
    case 'partly-cloudy-day':
    case 'partly-cloudy-night': return { condition: 'Partly Cloudy', conditionCode: 'partly_cloudy' };
    case 'cloudy':          return { condition: 'Overcast',        conditionCode: 'cloudy' };
    case 'fog':             return { condition: 'Foggy',           conditionCode: 'fog' };
    case 'rain':            return { condition: 'Rain',            conditionCode: 'rain' };
    case 'sleet':           return { condition: 'Freezing Rain',   conditionCode: 'freezing_rain' };
    case 'snow':            return { condition: 'Snow',            conditionCode: 'snow' };
    case 'wind':            return { condition: 'Windy',           conditionCode: 'cloudy' };
    case 'thunderstorm':    return { condition: 'Thunderstorm',    conditionCode: 'thunderstorm' };
    case 'hail':            return { condition: 'Hail',            conditionCode: 'snow' };
    case 'tornado':         return { condition: 'Tornado',         conditionCode: 'thunderstorm' };
    default:                return { condition: 'Unknown',         conditionCode: 'unknown' };
  }
}

// Pirate Weather moonPhase: 0–1 fraction of lunar cycle (0/1 = new moon, 0.5 = full)
function moonPhaseName(phase: number): string {
  if (phase < 0.0625 || phase >= 0.9375) return 'New Moon';
  if (phase < 0.1875)  return 'Waxing Crescent';
  if (phase < 0.3125)  return 'First Quarter';
  if (phase < 0.4375)  return 'Waxing Gibbous';
  if (phase < 0.5625)  return 'Full Moon';
  if (phase < 0.6875)  return 'Waning Gibbous';
  if (phase < 0.8125)  return 'Last Quarter';
  return 'Waning Crescent';
}

function toTime(unixSec: number, opts: Intl.DateTimeFormatOptions): string {
  return new Date(unixSec * 1000).toLocaleTimeString('en-US', opts);
}

const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

export async function getCurrentWeather(city: string, coords?: { lat: number; lon: number }): Promise<SourceReading> {
  const apiKey = process.env.PIRATE_WEATHER_API_KEY;
  if (!apiKey) throw new Error('PIRATE_WEATHER_API_KEY not set');

  const geo = coords ?? await geocode(city);
  const { data } = await axios.get(`${BASE}/${apiKey}/${geo.lat},${geo.lon}`, {
    params: { units: 'si', exclude: 'minutely,hourly,alerts' },
  });

  const c = data.currently;
  const today = data.daily?.data?.[0];
  const { condition, conditionCode } = iconToCondition(c.icon);

  return {
    source: 'Pirate Weather',
    temperature: c.temperature,
    feelsLike: c.apparentTemperature,
    humidity: Math.round((c.humidity ?? 0) * 100),
    windSpeed: parseFloat(((c.windSpeed ?? 0) * 3.6).toFixed(1)),
    precipitationProbability: Math.round((c.precipProbability ?? 0) * 100),
    condition,
    conditionCode,
    fetchedAt: new Date().toISOString(),
    uvIndex: c.uvIndex,
    pressure: c.pressure,
    dewPoint: c.dewPoint,
    visibility: c.visibility,
    windDirection: c.windBearing,
    windGust: c.windGust != null ? parseFloat((c.windGust * 3.6).toFixed(1)) : undefined,
    cloudCover: c.cloudCover != null ? Math.round(c.cloudCover * 100) : undefined,
    precipitationMm: c.precipIntensity,
    sunriseTime: today?.sunriseTime ? toTime(today.sunriseTime, TIME_OPTS) : undefined,
    sunsetTime:  today?.sunsetTime  ? toTime(today.sunsetTime,  TIME_OPTS) : undefined,
    moonPhase:   today?.moonPhase  != null ? moonPhaseName(today.moonPhase) : undefined,
  };
}

export interface PrecipMinute {
  time: string;
  precipProbability: number;
  precipIntensity: number;
}

// Minute-by-minute precip for the next 60 minutes — Pirate Weather's strongest data point
export async function getPrecipTimeline(city: string, coords?: { lat: number; lon: number }): Promise<PrecipMinute[]> {
  const apiKey = process.env.PIRATE_WEATHER_API_KEY;
  if (!apiKey) throw new Error('PIRATE_WEATHER_API_KEY not set');

  const geo = coords ?? await geocode(city);
  const { data } = await axios.get(`${BASE}/${apiKey}/${geo.lat},${geo.lon}`, {
    params: { units: 'si', exclude: 'currently,hourly,daily,alerts' },
  });

  if (!data.minutely?.data) return [];

  const now = new Date();
  const cutoff = new Date(now.getTime() + 60 * 60 * 1000);

  return data.minutely.data
    .filter((m: any) => {
      const t = new Date(m.time * 1000);
      return t >= now && t <= cutoff;
    })
    .map((m: any) => ({
      time: new Date(m.time * 1000).toISOString(),
      precipProbability: Math.round((m.precipProbability ?? 0) * 100),
      precipIntensity: m.precipIntensity ?? 0,
    }));
}

export async function getHourlyForecast(city: string, coords?: { lat: number; lon: number }, days: number = 2): Promise<HourlyReading[]> {
  const apiKey = process.env.PIRATE_WEATHER_API_KEY;
  if (!apiKey) throw new Error('PIRATE_WEATHER_API_KEY not set');

  const geo = coords ?? await geocode(city);
  // extend=hourly gives 168h; without it you get 48h
  const { data } = await axios.get(`${BASE}/${apiKey}/${geo.lat},${geo.lon}`, {
    params: { units: 'si', exclude: 'currently,minutely,daily,alerts', extend: days > 2 ? 'hourly' : undefined },
  });

  if (!data.hourly?.data) return [];

  return data.hourly.data.slice(0, days * 24).map((h: any) => {
    const { condition, conditionCode } = iconToCondition(h.icon);
    return {
      time: new Date(h.time * 1000).toISOString(),
      temperature: h.temperature,
      precipitationProbability: Math.round((h.precipProbability ?? 0) * 100),
      precipitationMm: h.precipIntensity ?? 0,
      windSpeed: parseFloat(((h.windSpeed ?? 0) * 3.6).toFixed(1)),
      condition,
      conditionCode,
      pressure: h.pressure,
    } satisfies HourlyReading;
  });
}

export async function getForecast(city: string, days: number = 7, coords?: { lat: number; lon: number }): Promise<ForecastDay[]> {
  const apiKey = process.env.PIRATE_WEATHER_API_KEY;
  if (!apiKey) throw new Error('PIRATE_WEATHER_API_KEY not set');

  const geo = coords ?? await geocode(city);
  const { data } = await axios.get(`${BASE}/${apiKey}/${geo.lat},${geo.lon}`, {
    params: { units: 'si', exclude: 'currently,minutely,hourly,alerts' },
  });

  if (!data.daily?.data) return [];

  return data.daily.data.slice(0, days).map((d: any) => {
    const { condition, conditionCode } = iconToCondition(d.icon);
    return {
      date: new Date(d.time * 1000).toISOString().split('T')[0],
      high: d.temperatureHigh,
      low: d.temperatureLow,
      spreadHigh: d.temperatureHigh,
      spreadLow: d.temperatureLow,
      precipitationProbability: Math.round((d.precipProbability ?? 0) * 100),
      condition,
      conditionCode,
      isDisputed: false,
      uvIndexMax: d.uvIndex,
      precipMm: d.precipIntensityMax,
      windGustMax: d.windGust != null ? parseFloat((d.windGust * 3.6).toFixed(1)) : undefined,
      snowfallMm: d.snowfallIntensity,
      sunriseTime: d.sunriseTime ? toTime(d.sunriseTime, TIME_OPTS) : undefined,
      sunsetTime:  d.sunsetTime  ? toTime(d.sunsetTime,  TIME_OPTS) : undefined,
    } satisfies ForecastDay;
  });
}
