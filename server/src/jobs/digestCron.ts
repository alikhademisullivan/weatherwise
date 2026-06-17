import cron from 'node-cron';
import axios from 'axios';
import { getSubscribers, sendDailyDigest } from '../services/emailDigest';

const SERVER_URL = process.env.APP_URL
  ? `${process.env.APP_URL}/api`
  : `http://localhost:${process.env.PORT ?? 3001}/api`;

async function buildWeatherSummary(city: string): Promise<string> {
  try {
    const [currentRes, forecastRes] = await Promise.all([
      axios.get(`${SERVER_URL}/weather/current`, { params: { city } }),
      axios.get(`${SERVER_URL}/weather/forecast`, { params: { city, days: 3 } }),
    ]);

    const w = currentRes.data;
    const forecast = forecastRes.data.forecast as Array<{
      date: string; high: number; low: number; precipitationProbability: number; condition: string;
    }>;

    const today = forecast[0];
    const tomorrow = forecast[1];
    const dayAfter = forecast[2];

    const confidence = w.consensus.confidenceScore;
    const agreed = confidence >= 70 ? 'Sources agree' : confidence >= 45 ? 'Sources partially agree' : 'Sources disagree';

    return [
      `Good morning! Here's your WeatherWise digest for ${city}.`,
      '',
      `TODAY: ${Math.round(w.consensus.temperature)}°C, ${w.consensus.condition}`,
      `  High ${Math.round(today?.high ?? w.consensus.temperature)}° / Low ${Math.round(today?.low ?? w.consensus.temperature)}°`,
      `  Feels like ${Math.round(w.consensus.feelsLike)}° · Rain ${w.consensus.precipitationProbability}%`,
      `  ${agreed} (${confidence}/100 confidence)`,
      '',
      tomorrow ? `TOMORROW: High ${Math.round(tomorrow.high)}°/ Low ${Math.round(tomorrow.low)}° — ${tomorrow.condition} · Rain ${tomorrow.precipitationProbability}%` : '',
      dayAfter ? `IN 2 DAYS: High ${Math.round(dayAfter.high)}°/ Low ${Math.round(dayAfter.low)}° — ${dayAfter.condition}` : '',
    ].filter(Boolean).join('\n');
  } catch (err: any) {
    return `Good morning! WeatherWise couldn't fetch today's forecast for ${city}. Check the app directly.`;
  }
}

export function scheduleDigestCron(): void {
  // Fire at 6:00 AM every day in the server's local timezone
  cron.schedule('0 6 * * *', async () => {
    console.log('[Digest Cron] Sending daily digests…');
    const subscribers = await getSubscribers();
    if (!subscribers.length) return;

    for (const sub of subscribers) {
      const summary = await buildWeatherSummary(sub.city);
      await sendDailyDigest(sub, summary);
    }
    console.log(`[Digest Cron] Done — sent to ${subscribers.length} subscriber(s)`);
  });

  console.log('[Digest Cron] Scheduled for 6:00 AM daily');
}
