import type { HourlyReading } from '../types/weather';

interface Props {
  hours: HourlyReading[];
}

const RAIN_THRESHOLD = 40; // % precipitation probability considered "rainy"
const OUTDOOR_COMFORT_TEMP_LOW = 10;
const OUTDOOR_COMFORT_TEMP_HIGH = 28;

function scoreHour(h: HourlyReading): number {
  let tempScore = 100;
  if (h.temperature < 18) tempScore = Math.max(0, 100 - (18 - h.temperature) * 5);
  else if (h.temperature > 24) tempScore = Math.max(0, 100 - (h.temperature - 24) * 5);

  const precipScore = Math.max(0, 100 - h.precipitationProbability);
  const windScore = Math.max(0, 100 - Math.max(0, h.windSpeed - 15) * 3);

  let condBonus = 0;
  if (['clear', 'partly_cloudy'].includes(h.conditionCode)) condBonus = 10;
  else if (['rain', 'thunderstorm', 'snow'].includes(h.conditionCode)) condBonus = -20;

  return Math.round((tempScore * 0.35 + precipScore * 0.40 + windScore * 0.25) + condBonus);
}

function formatHour12(isoTime: string): string {
  const d = new Date(isoTime);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h} ${ampm}`;
}

interface RainTiming {
  currentlyRaining: boolean;
  clearsAt: string | null;
  returnsAt: string | null;
  dryWindowHours: number;
}

function analyzeRainTiming(hours: HourlyReading[]): RainTiming {
  if (!hours.length) return { currentlyRaining: false, clearsAt: null, returnsAt: null, dryWindowHours: 0 };

  const currentlyRaining = hours[0].precipitationProbability >= RAIN_THRESHOLD;
  let clearsAt: string | null = null;
  let returnsAt: string | null = null;

  let inRain = currentlyRaining;
  for (let i = 1; i < hours.length; i++) {
    const nowRaining = hours[i].precipitationProbability >= RAIN_THRESHOLD;
    if (inRain && !nowRaining && !clearsAt) {
      clearsAt = hours[i].time;
    } else if (!inRain && nowRaining && clearsAt && !returnsAt) {
      returnsAt = hours[i].time;
      break;
    }
    inRain = nowRaining;
  }

  // Count dry hours today
  let dryWindowHours = 0;
  if (clearsAt) {
    const clearIdx = hours.findIndex(h => h.time === clearsAt);
    const returnIdx = returnsAt ? hours.findIndex(h => h.time === returnsAt) : hours.length;
    dryWindowHours = Math.max(0, returnIdx - clearIdx);
  } else if (!currentlyRaining) {
    const rainStart = hours.findIndex(h => h.precipitationProbability >= RAIN_THRESHOLD);
    dryWindowHours = rainStart === -1 ? hours.length : rainStart;
  }

  return { currentlyRaining, clearsAt, returnsAt, dryWindowHours };
}

interface BestWindow {
  startIdx: number;
  score: number;
  reason: string;
}

function findBestWindow(hours: HourlyReading[], scores: number[]): BestWindow {
  let bestScore = -1;
  let bestStart = 0;

  for (let i = 0; i < scores.length - 1; i++) {
    const windowScore = (scores[i].valueOf() + scores[Math.min(i + 1, scores.length - 1)]) / 2;
    if (windowScore > bestScore) {
      bestScore = windowScore;
      bestStart = i;
    }
  }

  const h = hours[bestStart];
  const reasons: string[] = [];
  if (h.precipitationProbability < 20) reasons.push('low rain chance');
  if (h.temperature >= OUTDOOR_COMFORT_TEMP_LOW && h.temperature <= OUTDOOR_COMFORT_TEMP_HIGH) reasons.push('comfortable temp');
  if (h.windSpeed < 15) reasons.push('calm winds');
  if (['clear', 'partly_cloudy'].includes(h.conditionCode)) reasons.push('clear skies');

  return {
    startIdx: bestStart,
    score: bestScore,
    reason: reasons.length ? reasons.join(', ') : 'best conditions available',
  };
}

const COND_EMOJI: Record<string, string> = {
  clear: '☀️', partly_cloudy: '⛅', cloudy: '☁️',
  rain: '🌧️', snow: '❄️', thunderstorm: '⛈️', fog: '🌫️', drizzle: '🌦️',
};

export default function BestTimeWidget({ hours }: Props) {
  // Only use daytime hours (6am–10pm) for best-window calculation
  const now = new Date();
  const relevant = hours.filter(h => {
    const d = new Date(h.time);
    return d > now && d.getHours() >= 6 && d.getHours() <= 22;
  });

  if (relevant.length < 2) return null;

  const scores = relevant.map(scoreHour);
  const best = findBestWindow(relevant, scores);
  const rain = analyzeRainTiming(hours);

  const startLabel = formatHour12(relevant[best.startIdx].time);
  const endLabel = formatHour12(relevant[Math.min(best.startIdx + 2, relevant.length - 1)].time);
  const bestHour = relevant[best.startIdx];

  const scoreColor =
    best.score >= 80 ? 'text-emerald-400' :
    best.score >= 60 ? 'text-yellow-400' :
    best.score >= 40 ? 'text-orange-400' : 'text-red-400';

  const scoreBg =
    best.score >= 80 ? 'bg-emerald-400/10 border-emerald-400/20' :
    best.score >= 60 ? 'bg-yellow-400/10 border-yellow-400/20' :
    best.score >= 40 ? 'bg-orange-400/10 border-orange-400/20' : 'bg-red-400/10 border-red-400/20';

  const emoji = COND_EMOJI[bestHour.conditionCode] ?? '🌤️';

  // Build rain insight string
  const rainInsight = (() => {
    if (rain.currentlyRaining && rain.clearsAt) {
      const msg = `Rain clears at ${formatHour12(rain.clearsAt)}`;
      return rain.returnsAt ? `${msg}, returns at ${formatHour12(rain.returnsAt)}` : msg;
    }
    if (!rain.currentlyRaining && rain.returnsAt) {
      return `Rain expected at ${formatHour12(rain.returnsAt)}`;
    }
    if (!rain.currentlyRaining && !rain.returnsAt) {
      // Check if any rain expected today
      const anyRain = hours.some(h => h.precipitationProbability >= RAIN_THRESHOLD);
      return anyRain ? null : 'No rain expected today';
    }
    return null;
  })();

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm px-4 py-3 space-y-3">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Best Time to Go Outside</h2>

      {/* Best window */}
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-4 ${scoreBg}`}>
        <div className="text-3xl">{emoji}</div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-base">{startLabel} – {endLabel}</p>
          <p className="text-white/50 text-xs mt-0.5 capitalize">{best.reason}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-lg font-bold ${scoreColor}`}>{Math.round(best.score)}</p>
          <p className="text-white/30 text-xs">/ 100</p>
        </div>
      </div>

      {/* Condition details row */}
      <div className="flex items-center gap-4 text-xs text-white/50 px-1">
        <span>🌡️ {bestHour.temperature.toFixed(0)}°C</span>
        <span>💧 {bestHour.precipitationProbability}% rain</span>
        <span>💨 {bestHour.windSpeed.toFixed(0)} km/h</span>
      </div>

      {/* Rain timing */}
      {rainInsight && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm">🌂</span>
          <p className="text-white/50 text-xs">{rainInsight}</p>
        </div>
      )}

      {/* Mini hourly comfort bar */}
      <div className="space-y-1">
        <p className="text-white/30 text-xs px-1">Comfort through the day</p>
        <div className="flex gap-0.5">
          {relevant.slice(0, 16).map((h, i) => {
            const s = scores[i];
            const barColor =
              s >= 80 ? 'bg-emerald-400' :
              s >= 60 ? 'bg-yellow-400' :
              s >= 40 ? 'bg-orange-400/70' : 'bg-red-400/50';
            const isRain = h.precipitationProbability >= RAIN_THRESHOLD;
            return (
              <div key={h.time} className="flex-1 flex flex-col items-center gap-0.5" title={`${formatHour12(h.time)}: score ${s}, ${h.precipitationProbability}% rain`}>
                <div className={`w-full rounded-sm transition-all ${barColor}`} style={{ height: `${Math.max(4, (s / 100) * 24)}px` }} />
                {isRain && <div className="w-1 h-1 rounded-full bg-blue-400/70" />}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-white/20 text-xs px-0.5">
          <span>{formatHour12(relevant[0].time)}</span>
          <span>{formatHour12(relevant[Math.min(15, relevant.length - 1)].time)}</span>
        </div>
      </div>

      <p className="text-white/20 text-xs px-1">Score = 40% rain chance · 35% temperature comfort · 25% wind</p>
    </div>
  );
}
