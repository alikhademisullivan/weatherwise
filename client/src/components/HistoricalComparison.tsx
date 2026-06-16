import type { HistoricalResponse } from '../types/weather';
import { formatTemp } from '../utils/formatters';

interface Props {
  data: HistoricalResponse;
  todayHigh?: number;
  unit: 'C' | 'F';
}

function diffLabel(today: number, historical: number, unit: 'C' | 'F'): { text: string; color: string } {
  const diff = today - historical;
  const rounded = Math.round(diff);
  if (rounded === 0) return { text: 'same as', color: 'text-white/50' };
  const sign = rounded > 0 ? '+' : '';
  const color = rounded > 0 ? 'text-red-400' : 'text-blue-400';
  return { text: `${sign}${rounded}°${unit}`, color };
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function HistoricalComparison({ data, todayHigh, unit }: Props) {
  const { yesterday, lastYear, yesterdayDate, lastYearDate } = data;

  if (!yesterday && !lastYear) return null;

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm px-5 py-4">
      <h3 className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Historical Context</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {yesterday && (
          <div className="bg-white/5 rounded-xl px-4 py-3 space-y-1">
            <div className="text-white/40 text-xs">Yesterday · {formatDate(yesterdayDate)}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-white font-semibold text-sm">
                {formatTemp(yesterday.high, unit)} / {formatTemp(yesterday.low, unit)}
              </span>
              {todayHigh != null && (
                (() => {
                  const d = diffLabel(todayHigh, yesterday.high, unit);
                  return <span className={`text-xs ${d.color}`}>{d.text} today</span>;
                })()
              )}
            </div>
            <div className="text-white/35 text-xs capitalize">{yesterday.condition}</div>
          </div>
        )}

        {lastYear && (
          <div className="bg-white/5 rounded-xl px-4 py-3 space-y-1">
            <div className="text-white/40 text-xs">Last year · {formatDate(lastYearDate)}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-white font-semibold text-sm">
                {formatTemp(lastYear.high, unit)} / {formatTemp(lastYear.low, unit)}
              </span>
              {todayHigh != null && (
                (() => {
                  const d = diffLabel(todayHigh, lastYear.high, unit);
                  return <span className={`text-xs ${d.color}`}>{d.text} today</span>;
                })()
              )}
            </div>
            <div className="text-white/35 text-xs capitalize">{lastYear.condition}</div>
          </div>
        )}

      </div>
    </div>
  );
}
