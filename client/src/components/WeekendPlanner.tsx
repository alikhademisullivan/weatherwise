import type { ForecastDay, HourlyReading } from '../types/weather';
import { formatTemp, conditionCodeToEmoji } from '../utils/formatters';

interface Props {
  forecast: ForecastDay[];
  hourly: HourlyReading[];
  unit: 'C' | 'F';
}

function getUpcomingWeekend(): { saturday: string; sunday: string } {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun, 6=Sat
  const daysToSat = dow === 6 ? 0 : (6 - dow);
  const sat = new Date(today);
  sat.setDate(today.getDate() + daysToSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  return {
    saturday: sat.toISOString().split('T')[0],
    sunday: sun.toISOString().split('T')[0],
  };
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function HourlyBars({ hours }: { hours: HourlyReading[] }) {
  if (!hours.length) return null;
  const slots = hours.filter((_, i) => i % 2 === 0).slice(0, 12); // Every 2h, max 12 bars
  return (
    <div className="mt-3">
      <p className="text-xs text-white/35 mb-1.5">Rain chance by hour</p>
      <div className="flex items-end gap-0.5 h-10">
        {slots.map((h, i) => {
          const pct = h.precipitationProbability;
          const hour = new Date(h.time).getHours();
          const heightPct = Math.max(4, pct);
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${heightPct}%`,
                  background: pct >= 60 ? 'rgba(96,165,250,0.8)' : pct >= 30 ? 'rgba(96,165,250,0.45)' : 'rgba(255,255,255,0.12)',
                  minHeight: 2,
                }}
                title={`${hour}:00 — ${pct}% rain`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {slots.filter((_, i) => i === 0 || i === Math.floor(slots.length / 2) || i === slots.length - 1).map((h, i) => (
          <span key={i} className="text-white/25 text-xs">
            {new Date(h.time).getHours()}:00
          </span>
        ))}
      </div>
    </div>
  );
}

function ConfidencePill({ tier }: { tier?: 'high' | 'medium' | 'low' }) {
  const map = {
    high:   { label: 'High confidence', cls: 'bg-emerald-400/15 text-emerald-300' },
    medium: { label: 'Some uncertainty', cls: 'bg-yellow-400/15 text-yellow-300' },
    low:    { label: 'Trend only', cls: 'bg-red-400/15 text-red-300' },
  };
  const { label, cls } = map[tier ?? 'high'];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
  );
}

function DayCard({ day, hourly, unit }: { day: ForecastDay; hourly: HourlyReading[]; unit: 'C' | 'F' }) {
  const dayHours = hourly.filter(h => h.time.startsWith(day.date));

  return (
    <div className={`rounded-xl p-4 border flex-1 ${
      day.confidenceTier === 'medium'
        ? 'bg-yellow-400/5 border-yellow-400/15'
        : day.confidenceTier === 'low'
        ? 'bg-red-400/5 border-red-400/15'
        : 'bg-white/8 border-white/15'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-white/50 text-xs font-medium">{dayLabel(day.date)}</p>
          <p className="text-white/80 text-sm mt-0.5">{day.condition}</p>
        </div>
        <span className="text-3xl leading-none">{conditionCodeToEmoji(day.conditionCode ?? day.condition)}</span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-light text-white">{formatTemp(day.high, unit)}</span>
        <span className="text-sm text-white/40">{formatTemp(day.low, unit)}</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs mb-3">
        <div className="bg-white/5 rounded-lg px-2.5 py-1.5">
          <span className="text-white/40">Rain</span>
          <span className="ml-1 text-white/70 font-medium">{day.precipitationProbability}%</span>
        </div>
        {day.uvIndexMax != null && (
          <div className="bg-white/5 rounded-lg px-2.5 py-1.5">
            <span className="text-white/40">UV</span>
            <span className="ml-1 text-white/70 font-medium">{day.uvIndexMax}</span>
          </div>
        )}
        {day.windGustMax != null && (
          <div className="bg-white/5 rounded-lg px-2.5 py-1.5">
            <span className="text-white/40">Gusts</span>
            <span className="ml-1 text-white/70 font-medium">{Math.round(day.windGustMax)} km/h</span>
          </div>
        )}
        {day.precipMm != null && day.precipMm > 0 && (
          <div className="bg-white/5 rounded-lg px-2.5 py-1.5">
            <span className="text-white/40">Rain</span>
            <span className="ml-1 text-white/70 font-medium">{day.precipMm} mm</span>
          </div>
        )}
      </div>

      <ConfidencePill tier={day.confidenceTier} />

      {day.confidenceTier === 'medium' && day.tempRangeLow != null && day.tempRangeHigh != null && (
        <p className="text-xs text-yellow-300/60 mt-2">
          Range: {formatTemp(day.tempRangeLow, unit)}–{formatTemp(day.tempRangeHigh, unit)}
        </p>
      )}

      {day.confidenceTier === 'low' && day.trend && (
        <p className="text-xs text-red-300/60 mt-2 italic">{day.trend}</p>
      )}

      {dayHours.length > 0 && <HourlyBars hours={dayHours} />}
    </div>
  );
}

export default function WeekendPlanner({ forecast, hourly, unit }: Props) {
  const { saturday, sunday } = getUpcomingWeekend();
  const satDay = forecast.find(d => d.date === saturday);
  const sunDay = forecast.find(d => d.date === sunday);

  if (!satDay && !sunDay) {
    return (
      <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-5">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2">Weekend Planner</h2>
        <p className="text-white/35 text-sm">Weekend forecast not yet available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Weekend Planner</h2>
        <span className="text-xs text-white/30">
          {new Date(saturday + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          –
          {new Date(sunday + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {satDay ? (
          <DayCard day={satDay} hourly={hourly} unit={unit} />
        ) : (
          <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-center">
            <p className="text-white/25 text-xs">Saturday data unavailable</p>
          </div>
        )}
        {sunDay ? (
          <DayCard day={sunDay} hourly={hourly} unit={unit} />
        ) : (
          <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-center">
            <p className="text-white/25 text-xs">Sunday data unavailable</p>
          </div>
        )}
      </div>

      {hourly.length > 0 && (
        <p className="text-white/25 text-xs text-center">
          Hourly rain bars shown when forecast data is available for that day.
        </p>
      )}
    </div>
  );
}
