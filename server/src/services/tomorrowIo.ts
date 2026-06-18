import axios from 'axios';
import type { SourceReading, ForecastDay } from '../types/weather';

const BASE = 'https://api.tomorrow.io/v4/weather';

// Tomorrow.io uses Open-Meteo geocoding since it doesn't have its own free geocode
async function geocode(city: string): Promise<{ lat: number; lon: number; name: string }> {
  const name = city.split(',')[0].trim();
  const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name, count: 1, language: 'en', format: 'json' },
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

export async function getCurrentWeather(city: string, coords?: { lat: number; lon: number }): Promise<SourceReading> {
  const apiKey = process.env.TOMORROW_IO_API_KEY;
  if (!apiKey) throw new Error('TOMORROW_IO_API_KEY not set');

  const geo = coords ? { lat: coords.lat, lon: coords.lon, name: city.split(',')[0].trim() } : await geocode(city);

  // Fetch realtime + today's daily in parallel for sunrise/sunset
  const [realtimeRes, dailyRes] = await Promise.allSettled([
    axios.get(`${BASE}/realtime`, {
      params: { location: `${geo.lat},${geo.lon}`, apikey: apiKey, units: 'metric' },
    }),
    axios.get(`${BASE}/forecast`, {
      params: {
        location: `${geo.lat},${geo.lon}`,
        apikey: apiKey,
        units: 'metric',
        timesteps: '1d',
      },
    }),
  ]);

  if (realtimeRes.status === 'rejected') throw realtimeRes.reason;

  const v = realtimeRes.value.data.data.values;
  const { condition, conditionCode } = tioCodeToCondition(v.weatherCode);

  let sunriseTime: string | undefined;
  let sunsetTime: string | undefined;
  if (dailyRes.status === 'fulfilled') {
    const today = dailyRes.value.data.timelines?.daily?.[0]?.values;
    if (today?.sunriseTime) {
      sunriseTime = new Date(today.sunriseTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
    if (today?.sunsetTime) {
      sunsetTime = new Date(today.sunsetTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
    if (today?.moonPhase != null) {
      // Tomorrow.io moon phase: 0=New, 1=Waxing Crescent, 2=First Quarter, 3=Waxing Gibbous,
      // 4=Full, 5=Waning Gibbous, 6=Last Quarter, 7=Waning Crescent
      const phases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
      // moonPhase is a number 0-7
    }
  }

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
    uvIndex: v.uvIndex,
    pressure: v.pressureSeaLevel,
    dewPoint: v.dewPoint,
    visibility: v.visibility,
    windDirection: v.windDirection,
    windGust: v.windGust != null ? parseFloat((v.windGust * 3.6).toFixed(1)) : undefined,
    cloudCover: v.cloudCover,
    sunriseTime,
    sunsetTime,
  };
}

export interface PrecipMinute {
  time: string;
  precipProbability: number;
  precipIntensity: number;
}

export async function getPrecipTimeline(city: string, coords?: { lat: number; lon: number }): Promise<PrecipMinute[]> {
  const apiKey = process.env.TOMORROW_IO_API_KEY;
  if (!apiKey) throw new Error('TOMORROW_IO_API_KEY not set');

  const geo = coords ? { lat: coords.lat, lon: coords.lon } : await geocode(city);

  const timelineRes = await axios.get('https://api.tomorrow.io/v4/timelines', {
    params: {
      location: `${geo.lat},${geo.lon}`,
      fields: ['precipitationProbability', 'precipitationIntensity'].join(','),
      timesteps: '1m',
      units: 'metric',
      apikey: apiKey,
    },
    validateStatus: status => status < 500,
  });

  if (timelineRes.status === 429) {
    throw new Error('TOMORROW_RATE_LIMITED');
  }

  const { data } = timelineRes;

  const timeline = data.data?.timelines?.[0];
  if (!timeline) return [];

  const now = new Date();
  const cutoff = new Date(now.getTime() + 60 * 60 * 1000); // 60 minutes ahead

  return timeline.intervals
    .filter((iv: any) => {
      const t = new Date(iv.startTime);
      return t >= now && t <= cutoff;
    })
    .map((iv: any) => ({
      time: iv.startTime,
      precipProbability: iv.values.precipitationProbability ?? 0,
      precipIntensity: iv.values.precipitationIntensity ?? 0,
    }));
}

export async function getForecast(city: string, days: number = 7, coords?: { lat: number; lon: number }): Promise<ForecastDay[]> {
  const apiKey = process.env.TOMORROW_IO_API_KEY;
  if (!apiKey) throw new Error('TOMORROW_IO_API_KEY not set');

  const geo = coords ? { lat: coords.lat, lon: coords.lon, name: city.split(',')[0].trim() } : await geocode(city);

  const { data } = await axios.get(`${BASE}/forecast`, {
    params: {
      location: `${geo.lat},${geo.lon}`,
      apikey: apiKey,
      units: 'metric',
      timesteps: '1d',
    },
  });

  const phases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];

  return data.timelines.daily.slice(0, days).map((d: any) => {
    const v = d.values;
    const { condition, conditionCode } = tioCodeToCondition(v.weatherCodeMax ?? v.weatherCode);

    let sunriseTime: string | undefined;
    let sunsetTime: string | undefined;
    if (v.sunriseTime) {
      sunriseTime = new Date(v.sunriseTime).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
    }
    if (v.sunsetTime) {
      sunsetTime = new Date(v.sunsetTime).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
    }

    return {
      date: d.time.split('T')[0],
      high: v.temperatureMax,
      low: v.temperatureMin,
      spreadHigh: v.temperatureMax,
      spreadLow: v.temperatureMin,
      precipitationProbability: v.precipitationProbabilityAvg ?? 0,
      condition,
      conditionCode,
      isDisputed: false,
      uvIndexMax: v.uvIndexMax,
      precipMm: v.precipitationIntensityAvg,
      windGustMax: v.windGustMax != null ? parseFloat((v.windGustMax * 3.6).toFixed(1)) : undefined,
      sunriseTime,
      sunsetTime,
    } satisfies ForecastDay;
  });
}
