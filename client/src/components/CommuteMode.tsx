import { useState } from 'react';
import type { HourlyReading } from '../types/weather';
import { formatTemp, conditionCodeToEmoji, formatWind } from '../utils/formatters';

interface CommuteTimes {
  morning: string;
  evening: string;
}

const STORAGE_KEY = 'ww-commute-times';
const DEFAULT_TIMES: CommuteTimes = { morning: '08:00', evening: '17:30' };

function loadTimes(): CommuteTimes {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? DEFAULT_TIMES;
  } catch {
    return DEFAULT_TIMES;
  }
}

function saveTimes(t: CommuteTimes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

function findClosestHour(hours: HourlyReading[], targetTime: string): HourlyReading | null {
  if (!hours.length) return null;
  const [hh, mm] = targetTime.split(':').map(Number);
  const targetMinutes = hh * 60 + (mm ?? 0);

  let best: HourlyReading | null = null;
  let bestDiff = Infinity;

  for (const h of hours) {
    const d = new Date(h.time);
    const minutesInDay = d.getHours() * 60 + d.getMinutes();
    const diff = Math.abs(minutesInDay - targetMinutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = h;
    }
  }
  return best;
}

function formatHour(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getCommuteLabel(time: string): string {
  const [hh] = time.split(':').map(Number);
  return hh < 12 ? 'Morning commute' : 'Evening commute';
}

function CommuteCard({
  label,
  time,
  hour,
  unit,
}: {
  label: string;
  time: string;
  hour: HourlyReading | null;
  unit: 'C' | 'F';
}) {
  if (!hour) {
    return (
      <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
        <p className="text-xs text-white/40 font-medium">{label}</p>
        <p className="text-xs text-white/25">No data for {time}</p>
      </div>
    );
  }

  const precip = hour.precipitationProbability;
  const rainLabel =
    precip >= 70 ? '🌧 Bring an umbrella' :
    precip >= 40 ? '🌦 Rain possible' :
    '☀️ No rain expected';

  return (
    <div className="flex-1 rounded-xl bg-white/8 border border-white/15 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/50 font-medium">{label}</p>
        <span className="text-xs text-white/30">{formatHour(hour.time)}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none">{conditionCodeToEmoji(hour.conditionCode)}</span>
        <div>
          <span className="text-2xl font-light text-white">{formatTemp(hour.temperature, unit)}</span>
          <p className="text-xs text-white/50 mt-0.5">{hour.condition}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="bg-white/5 rounded-lg px-2.5 py-1.5">
          <span className="text-white/40">Rain</span>
          <span className="ml-1 text-white/70 font-medium">{precip}%</span>
        </div>
        <div className="bg-white/5 rounded-lg px-2.5 py-1.5">
          <span className="text-white/40">Wind</span>
          <span className="ml-1 text-white/70 font-medium">{formatWind(hour.windSpeed, unit)}</span>
        </div>
      </div>

      <p className="text-xs text-white/60 bg-white/5 rounded-lg px-2.5 py-2">{rainLabel}</p>
    </div>
  );
}

interface Props {
  hours: HourlyReading[];
  unit: 'C' | 'F';
}

export default function CommuteMode({ hours, unit }: Props) {
  const [times, setTimes] = useState<CommuteTimes>(loadTimes);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CommuteTimes>(loadTimes);

  const morningHour = findClosestHour(hours, times.morning);
  const eveningHour = findClosestHour(hours, times.evening);

  function saveAndClose() {
    setTimes(draft);
    saveTimes(draft);
    setEditing(false);
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Commute Times</h2>
        <button
          onClick={() => { setDraft(times); setEditing(v => !v); }}
          className="text-xs bg-white/10 hover:bg-white/15 text-white/60 px-2.5 py-1 rounded-lg transition-colors"
        >
          {editing ? 'Cancel' : '⚙ Times'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50 block mb-1">Morning departure</label>
            <input
              type="time"
              value={draft.morning}
              onChange={e => setDraft(d => ({ ...d, morning: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">Evening return</label>
            <input
              type="time"
              value={draft.evening}
              onChange={e => setDraft(d => ({ ...d, evening: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={saveAndClose}
            className="w-full text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors"
          >
            Save times
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3">
          <CommuteCard
            label={getCommuteLabel(times.morning)}
            time={times.morning}
            hour={morningHour}
            unit={unit}
          />
          <CommuteCard
            label={getCommuteLabel(times.evening)}
            time={times.evening}
            hour={eveningHour}
            unit={unit}
          />
        </div>
      )}

      <p className="text-white/40 text-xs text-center">
        Showing weather at your saved commute times · tap ⚙ to adjust
      </p>
    </div>
  );
}
