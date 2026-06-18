import { useState, useEffect, useRef } from 'react';
import type { ConsensusReading, ForecastDay } from '../types/weather';

interface AlertThresholds {
  windKmh: number | null;
  rainPct: number | null;
  tempLow: number | null;
  spreadC: number | null;
  frostAlert: boolean;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  windKmh: null,
  rainPct: null,
  tempLow: null,
  spreadC: null,
  frostAlert: false,
};

const STORAGE_KEY = 'ww-alert-thresholds';

function loadThresholds(): AlertThresholds {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? DEFAULT_THRESHOLDS;
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

function saveThresholds(t: AlertThresholds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

function fireNotification(title: string, body: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

interface Props {
  consensus: ConsensusReading | undefined;
  city: string;
  forecast?: ForecastDay[];
}

export default function CustomAlerts({ consensus, city, forecast }: Props) {
  const [thresholds, setThresholds] = useState<AlertThresholds>(loadThresholds);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AlertThresholds>(loadThresholds);
  const firedRef = useRef<Set<string>>(new Set());
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  // Check thresholds whenever consensus or forecast updates
  useEffect(() => {
    if (!consensus || permission !== 'granted') return;

    const { windSpeed, precipitationProbability, temperature, spread } = consensus;

    if (thresholds.windKmh !== null && windSpeed >= thresholds.windKmh) {
      const key = `wind-${city}-${Math.floor(windSpeed / 10)}`;
      if (!firedRef.current.has(key)) {
        firedRef.current.add(key);
        fireNotification(
          `WeatherWise: High winds in ${city}`,
          `Wind speed ${Math.round(windSpeed)} km/h (your alert: ≥${thresholds.windKmh} km/h)`
        );
      }
    }

    if (thresholds.rainPct !== null && precipitationProbability >= thresholds.rainPct) {
      const key = `rain-alert-${city}-${Math.floor(precipitationProbability / 10)}`;
      if (!firedRef.current.has(key)) {
        firedRef.current.add(key);
        fireNotification(
          `WeatherWise: Rain alert for ${city}`,
          `${precipitationProbability}% rain probability (your alert: ≥${thresholds.rainPct}%)`
        );
      }
    }

    if (thresholds.tempLow !== null && temperature <= thresholds.tempLow) {
      const key = `temp-low-${city}-${Math.floor(temperature)}`;
      if (!firedRef.current.has(key)) {
        firedRef.current.add(key);
        fireNotification(
          `WeatherWise: Cold alert for ${city}`,
          `Temperature ${Math.round(temperature)}°C (your alert: ≤${thresholds.tempLow}°C)`
        );
      }
    }

    if (thresholds.spreadC !== null && spread >= thresholds.spreadC) {
      const key = `spread-${city}-${Math.floor(spread)}`;
      if (!firedRef.current.has(key)) {
        firedRef.current.add(key);
        fireNotification(
          `WeatherWise: Forecasts split for ${city}`,
          `Sources disagree by ${spread.toFixed(1)}°C (your alert: ≥${thresholds.spreadC}°C)`
        );
      }
    }

    if (thresholds.frostAlert && forecast && forecast.length > 0 && consensus.dewPoint != null) {
      const tonight = forecast[0];
      const tomorrow = forecast[1];
      const dateStr = tonight.date;
      if (tonight.low <= 2 && consensus.dewPoint <= 2) {
        const key = `frost-${city}-${dateStr}`;
        if (!firedRef.current.has(key)) {
          firedRef.current.add(key);
          fireNotification(
            `WeatherWise: Frost risk tonight in ${city}`,
            `Low of ${Math.round(tonight.low)}°C near dew point — consider covering plants`
          );
        }
      } else if (tomorrow && tomorrow.low <= 2) {
        const key = `frost-tomorrow-${city}-${tomorrow.date}`;
        if (!firedRef.current.has(key)) {
          firedRef.current.add(key);
          fireNotification(
            `WeatherWise: Frost risk tomorrow night in ${city}`,
            `Low of ${Math.round(tomorrow.low)}°C — cover plants before nightfall`
          );
        }
      }
    }
  }, [consensus, forecast, thresholds, city, permission]);

  // Reset fired keys when city changes
  useEffect(() => {
    firedRef.current.clear();
  }, [city]);

  function saveAndClose() {
    setThresholds(draft);
    saveThresholds(draft);
    setEditing(false);
  }

  function clearAll() {
    const cleared = DEFAULT_THRESHOLDS;
    setDraft(cleared);
    setThresholds(cleared);
    saveThresholds(cleared);
  }

  const activeCount = [
    thresholds.windKmh !== null,
    thresholds.rainPct !== null,
    thresholds.tempLow !== null,
    thresholds.spreadC !== null,
    thresholds.frostAlert,
  ].filter(Boolean).length;

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🔔</span>
          <span className="text-sm font-medium text-white/70">Custom Alerts</span>
          {activeCount > 0 && (
            <span className="text-xs bg-blue-500/25 text-blue-300 px-1.5 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-white/30 hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => { setDraft(thresholds); setEditing(v => !v); }}
            className="text-xs bg-white/10 hover:bg-white/15 text-white/60 px-2.5 py-1 rounded-lg transition-colors"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {permission !== 'granted' && (
        <p className="text-xs text-amber-400/70">
          Enable notifications first (above) to receive these alerts.
        </p>
      )}

      {!editing && activeCount === 0 && (
        <p className="text-xs text-white/30">
          No custom thresholds set. Click Edit to configure alerts for wind, rain, temperature, or forecast disputes.
        </p>
      )}

      {!editing && activeCount > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {thresholds.windKmh !== null && (
            <div className="text-xs bg-white/5 rounded-lg px-3 py-2">
              <span className="text-white/40">Wind ≥</span>{' '}
              <span className="text-white/70 font-medium">{thresholds.windKmh} km/h</span>
            </div>
          )}
          {thresholds.rainPct !== null && (
            <div className="text-xs bg-white/5 rounded-lg px-3 py-2">
              <span className="text-white/40">Rain ≥</span>{' '}
              <span className="text-white/70 font-medium">{thresholds.rainPct}%</span>
            </div>
          )}
          {thresholds.tempLow !== null && (
            <div className="text-xs bg-white/5 rounded-lg px-3 py-2">
              <span className="text-white/40">Temp ≤</span>{' '}
              <span className="text-white/70 font-medium">{thresholds.tempLow}°C</span>
            </div>
          )}
          {thresholds.spreadC !== null && (
            <div className="text-xs bg-white/5 rounded-lg px-3 py-2">
              <span className="text-white/40">Disagreement ≥</span>{' '}
              <span className="text-white/70 font-medium">{thresholds.spreadC}°C</span>
            </div>
          )}
          {thresholds.frostAlert && (
            <div className="text-xs bg-blue-400/10 rounded-lg px-3 py-2 col-span-2">
              <span className="text-blue-300/70">❄️ Frost risk alerts on</span>
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <ThresholdInput
            label="Wind speed (km/h)"
            placeholder="e.g. 30"
            value={draft.windKmh}
            onChange={v => setDraft(d => ({ ...d, windKmh: v }))}
            hint="Alert when wind exceeds this speed"
          />
          <ThresholdInput
            label="Rain probability (%)"
            placeholder="e.g. 60"
            value={draft.rainPct}
            onChange={v => setDraft(d => ({ ...d, rainPct: v }))}
            hint="Alert when rain chance reaches this level"
          />
          <ThresholdInput
            label="Temperature low (°C)"
            placeholder="e.g. 5"
            value={draft.tempLow}
            onChange={v => setDraft(d => ({ ...d, tempLow: v }))}
            hint="Alert when temperature drops to or below this"
          />
          <ThresholdInput
            label="Source disagreement (°C)"
            placeholder="e.g. 4"
            value={draft.spreadC}
            onChange={v => setDraft(d => ({ ...d, spreadC: v }))}
            hint="Alert when sources differ by this much"
          />
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Frost risk alert</label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                role="checkbox"
                aria-checked={draft.frostAlert}
                onClick={() => setDraft(d => ({ ...d, frostAlert: !d.frostAlert }))}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  draft.frostAlert ? 'bg-blue-500' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    draft.frostAlert ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </div>
              <span className="text-xs text-white/50">Notify if overnight low may freeze plants</span>
            </label>
            <p className="text-white/25 text-xs">Triggers when low ≤ 2°C and dew point is near freezing</p>
          </div>
          <button
            onClick={saveAndClose}
            className="w-full text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors"
          >
            Save thresholds
          </button>
        </div>
      )}
    </div>
  );
}

function ThresholdInput({
  label, placeholder, value, onChange, hint,
}: {
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (v: number | null) => void;
  hint: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-white/50 font-medium">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          placeholder={placeholder}
          value={value ?? ''}
          onChange={e => {
            const n = parseFloat(e.target.value);
            onChange(isNaN(n) ? null : n);
          }}
          className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white/80 text-xs placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {value !== null && (
          <button
            onClick={() => onChange(null)}
            className="text-white/25 hover:text-white/50 text-sm"
          >
            ✕
          </button>
        )}
      </div>
      <p className="text-white/25 text-xs">{hint}</p>
    </div>
  );
}
