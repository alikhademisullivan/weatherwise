import type { HourlyReading } from '../types/weather';

interface Props {
  hours: HourlyReading[];
}

function scoreHour(h: HourlyReading): number {
  // Temperature: optimal 18–24°C = 100pts
  let tempScore = 100;
  if (h.temperature < 18) tempScore = Math.max(0, 100 - (18 - h.temperature) * 5);
  else if (h.temperature > 24) tempScore = Math.max(0, 100 - (h.temperature - 24) * 5);

  // Precipitation: lower is better
  const precipScore = Math.max(0, 100 - h.precipitationProbability);

  // Wind: <15 km/h = 100pts, scales down
  const windScore = Math.max(0, 100 - Math.max(0, h.windSpeed - 15) * 3);

  // Condition bonus: clear/partly_cloudy get a boost
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

export default function BestTimeWidget({ hours }: Props) {
  if (hours.length < 2) return null;

  // Score all hours and find best consecutive 2-hour window
  const scores = hours.map(h => ({ hour: h, score: scoreHour(h) }));

  let bestScore = -1;
  let bestStart = 0;
  for (let i = 0; i < scores.length - 1; i++) {
    const windowScore = (scores[i].score + scores[i + 1].score) / 2;
    if (windowScore > bestScore) {
      bestScore = windowScore;
      bestStart = i;
    }
  }

  const startLabel = formatHour12(hours[bestStart].time);
  const endLabel = formatHour12(hours[Math.min(bestStart + 2, hours.length - 1)].time);

  const scoreColor =
    bestScore >= 80 ? 'text-emerald-400' :
    bestScore >= 60 ? 'text-yellow-400' :
    bestScore >= 40 ? 'text-orange-400' : 'text-red-400';

  const condEmoji = (() => {
    const code = hours[bestStart].conditionCode;
    const map: Record<string, string> = {
      clear: '☀️', partly_cloudy: '⛅', cloudy: '☁️',
      rain: '🌧️', snow: '❄️', thunderstorm: '⛈️', fog: '🌫️',
    };
    return map[code] ?? '🌤️';
  })();

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm px-5 py-4">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Best Time to Go Outside</h2>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{condEmoji}</span>
        <div>
          <p className="text-white font-semibold">
            {startLabel} – {endLabel}
          </p>
          <p className="text-white/40 text-xs">
            Comfort score: <span className={`font-semibold ${scoreColor}`}>{Math.round(bestScore)}/100</span>
            {' · '}{hours[bestStart].temperature.toFixed(0)}°C · {hours[bestStart].precipitationProbability}% rain
          </p>
        </div>
      </div>
    </div>
  );
}
