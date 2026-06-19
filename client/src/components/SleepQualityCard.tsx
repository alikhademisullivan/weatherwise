import type { ConsensusReading, HourlyReading, LocalSensorReading } from '../types/weather';
import { formatTemp } from '../utils/formatters';

interface Props {
  consensus: ConsensusReading;
  hourly: HourlyReading[];
  unit: 'C' | 'F';
  localSensor?: LocalSensorReading;
}

// Magnus-formula dewpoint approximation from temperature (°C) + relative humidity (%)
function sensorDewPoint(tempC: number, rh: number): number {
  return parseFloat((tempC - (100 - rh) / 5).toFixed(1));
}

export default function SleepQualityCard({ consensus, hourly, unit, localSensor }: Props) {
  const now = new Date();

  // Build tonight's sleep window: next occurrence of 9pm → 7am
  const windowStart = new Date(now);
  windowStart.setHours(21, 0, 0, 0);
  if (windowStart <= now) windowStart.setDate(windowStart.getDate() + 1);

  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + 1);
  windowEnd.setHours(7, 0, 0, 0);

  const nightHours = hourly.filter(h => {
    const t = new Date(h.time);
    return t >= windowStart && t <= windowEnd;
  });

  if (nightHours.length < 3) return null;

  // API always returns Celsius; unit prop is display-only
  const overnightLow = Math.min(...nightHours.map(h => h.temperature));

  let score = 10;
  const factors: string[] = [];

  if (overnightLow > 24) {
    score -= 3;
    factors.push(`Very warm overnight — ${formatTemp(overnightLow, unit)} low`);
  } else if (overnightLow > 20) {
    score -= 2;
    factors.push(`Warm overnight — ${formatTemp(overnightLow, unit)} low`);
  } else if (overnightLow < 10) {
    score -= 1;
    factors.push(`Cool overnight — ${formatTemp(overnightLow, unit)} low`);
  }

  // Prefer sensor-derived dewpoint when a nearby station has humidity data
  const sensorDp = localSensor?.humidity != null
    ? sensorDewPoint(localSensor.temperature, localSensor.humidity)
    : undefined;
  const dp = sensorDp ?? consensus.dewPoint;
  const dpSource = sensorDp != null ? ' (local sensor)' : '';
  if (dp !== undefined) {
    if (dp > 16) {
      score -= 2;
      factors.push(`Muggy — ${Math.round(dp)}°C dew point${dpSource}`);
    } else if (dp < 10) {
      score += 1;
      factors.push(`Dry, crisp air — ${Math.round(dp)}°C dew point${dpSource}`);
    }
  }

  if (consensus.windSpeed > 25) {
    score -= 1;
    factors.push(`Breezy — ${Math.round(consensus.windSpeed)} km/h winds`);
  }

  score = Math.max(2, Math.min(10, score));

  const label = score >= 8 ? 'Ideal' : score >= 6 ? 'Good' : score >= 4 ? 'Fair' : 'Poor';
  const scoreColor = score >= 8 ? 'text-emerald-400' : score >= 6 ? 'text-blue-400' : score >= 4 ? 'text-yellow-400' : 'text-red-400';
  const scoreBg = score >= 8 ? 'bg-emerald-400/10' : score >= 6 ? 'bg-blue-400/10' : score >= 4 ? 'bg-yellow-400/10' : 'bg-red-400/10';

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🌙</span>
          <span className="text-sm font-medium text-white/70">Tonight's Sleep</span>
        </div>
        <div className={`flex items-center gap-1.5 ${scoreBg} rounded-full px-3 py-1`}>
          <span className={`text-lg font-bold ${scoreColor}`}>{score}</span>
          <span className={`text-xs font-medium ${scoreColor}`}>/ 10 — {label}</span>
        </div>
      </div>

      {factors.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {factors.map((f, i) => (
            <span key={i} className="text-xs bg-white/5 text-white/50 px-2.5 py-1 rounded-full">
              {f}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-emerald-400/70">Conditions look optimal for sleep tonight.</p>
      )}

      <p className="text-xs text-white/25 mt-2.5">Based on overnight temp, humidity & wind</p>
    </div>
  );
}
