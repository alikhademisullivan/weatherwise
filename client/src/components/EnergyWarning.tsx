import { useState } from 'react';
import type { ForecastDay, HistoricalResponse } from '../types/weather';
import { formatTemp } from '../utils/formatters';

interface Props {
  forecast: ForecastDay[];
  historical: HistoricalResponse | undefined;
  unit: 'C' | 'F';
}

const STORAGE_KEY = 'ww-energy-warning-dismissed';

function getDismissedDate(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export default function EnergyWarning({ forecast, historical, unit }: Props) {
  const today = getTodayStr();
  const [dismissed, setDismissed] = useState<string | null>(() => getDismissedDate());

  if (dismissed === today) return null;

  const days = forecast.slice(0, 5);
  if (days.length < 3) return null;

  // Check for heat or cold extremes (API values always in Celsius)
  const hotDays = days.filter(d => d.high > 32).length;
  const coldDays = days.filter(d => d.low < -5).length;

  // Check deviation vs last year's same-date high
  let deviationNote: string | null = null;
  if (historical?.lastYear?.high != null) {
    const avgForecastHigh = days.reduce((s, d) => s + d.high, 0) / days.length;
    const diff = avgForecastHigh - historical.lastYear.high;
    if (Math.abs(diff) >= 8) {
      const dir = diff > 0 ? 'above' : 'below';
      deviationNote = `${Math.abs(Math.round(diff))}°C ${dir} last year's average`;
    }
  }

  let message: string | null = null;
  let icon = '⚡';

  if (hotDays >= 3) {
    message = `Extended heat wave this week — expect higher cooling costs`;
    if (deviationNote) message += ` (${deviationNote})`;
  } else if (coldDays >= 3) {
    message = `Extended cold snap this week — expect higher heating costs`;
    if (deviationNote) message += ` (${deviationNote})`;
  } else if (deviationNote) {
    message = `This week's temperatures are ${deviationNote} — energy demand may be elevated`;
  }

  if (!message) return null;

  // Show the high/low range context
  const forecastHigh = Math.max(...days.map(d => d.high));
  const forecastLow = Math.min(...days.map(d => d.low));

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, today);
    setDismissed(today);
  }

  return (
    <div className="rounded-xl bg-orange-400/10 border border-orange-400/25 px-4 py-3 flex items-start gap-3">
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-orange-300/90">{message}</p>
        <p className="text-xs text-white/30 mt-0.5">
          This week: {formatTemp(forecastLow, unit)} – {formatTemp(forecastHigh, unit)}
        </p>
      </div>
      <button
        onClick={dismiss}
        className="text-white/25 hover:text-white/50 transition-colors text-sm shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
