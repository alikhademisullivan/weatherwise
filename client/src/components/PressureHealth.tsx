import { useState, useMemo } from 'react';
import type { HourlyReading } from '../types/weather';

interface Settings {
  enabled: boolean;
}

const STORAGE_KEY = 'ww-pressure-health';
const DEFAULT: Settings = { enabled: false };

function load(): Settings {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') ?? DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function save(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

interface Props {
  hourly: HourlyReading[];
}

export default function PressureHealth({ hourly }: Props) {
  const [settings, setSettings] = useState<Settings>(load);

  function toggle() {
    const next = { enabled: !settings.enabled };
    setSettings(next);
    save(next);
  }

  const { pressurePoints, riskLabel, riskColor } = useMemo(() => {
    const now = new Date();

    // Collect up to 12 past + 12 future hours with pressure data
    const withPressure = hourly.filter(h => h.pressure != null);
    const pastCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const futureCutoff = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    const points = withPressure
      .filter(h => {
        const t = new Date(h.time);
        return t >= pastCutoff && t <= futureCutoff;
      })
      .map(h => ({ time: new Date(h.time), pressure: h.pressure as number }));

    // Calculate max pressure drop over any 3-hour window in the next 6 hours
    const futurePoints = points.filter(p => p.time >= now);
    let maxDrop = 0;
    for (let i = 0; i < futurePoints.length; i++) {
      const p1 = futurePoints[i].pressure;
      const p2 = futurePoints.find(p => {
        const diffHr = (p.time.getTime() - futurePoints[i].time.getTime()) / 3_600_000;
        return diffHr >= 2.5 && diffHr <= 3.5;
      })?.pressure;
      if (p1 != null && p2 != null) {
        const drop = p1 - p2;
        if (drop > maxDrop) maxDrop = drop;
      }
    }

    const risk: 'high' | 'moderate' | 'stable' =
      maxDrop >= 4 ? 'high' : maxDrop >= 2 ? 'moderate' : 'stable';

    const riskLabel =
      risk === 'high'
        ? 'Rapid drop — migraine/joint flare risk'
        : risk === 'moderate'
        ? 'Pressure falling — possible sensitivity'
        : 'Pressure stable';

    const riskColor =
      risk === 'high' ? 'text-red-400' : risk === 'moderate' ? 'text-yellow-400' : 'text-emerald-400';

    return { pressurePoints: points, riskLabel, riskColor };
  }, [hourly]);

  if (!settings.enabled) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🌡️</span>
          <div>
            <span className="text-sm text-white/50">Pressure Health</span>
            <p className="text-xs text-white/25 mt-0.5">Migraine & joint sensitivity tracker</p>
          </div>
        </div>
        <button
          onClick={toggle}
          className="text-xs bg-white/10 hover:bg-white/15 text-white/60 hover:text-white/80 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          Enable
        </button>
      </div>
    );
  }

  const hasPressureData = pressurePoints.length >= 3;

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🌡️</span>
          <span className="text-sm font-medium text-white/70">Pressure Health</span>
        </div>
        <button
          onClick={toggle}
          className="text-xs text-white/25 hover:text-white/50 transition-colors"
        >
          Disable
        </button>
      </div>

      {!hasPressureData ? (
        <p className="text-xs text-white/35">Pressure trend data loading…</p>
      ) : (
        <>
          <div className={`text-sm font-medium mb-3 ${riskColor}`}>{riskLabel}</div>

          {/* Inline SVG sparkline */}
          <PressureSparkline points={pressurePoints} />

          <p className="text-xs text-white/25 mt-2">
            24-hour barometric pressure trend (hPa) · rapid drops trigger weather-sensitive conditions
          </p>
        </>
      )}
    </div>
  );
}

function PressureSparkline({ points }: { points: { time: Date; pressure: number }[] }) {
  if (points.length < 2) return null;

  const pressures = points.map(p => p.pressure);
  const minP = Math.min(...pressures);
  const maxP = Math.max(...pressures);
  const range = maxP - minP || 1;

  const width = 240;
  const height = 48;
  const pad = 4;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (p.pressure - minP) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Find the "now" divider index
  const now = new Date();
  const nowIdx = points.findIndex(p => p.time >= now);
  const nowX = nowIdx >= 0
    ? pad + (nowIdx / (points.length - 1)) * (width - pad * 2)
    : null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-12"
      preserveAspectRatio="none"
    >
      {/* Gradient area fill */}
      <defs>
        <linearGradient id="pressureGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`${coords.join(' ')} ${(width - pad).toFixed(1)},${height} ${pad},${height}`}
        fill="url(#pressureGrad)"
      />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke="#60a5fa"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* "Now" marker */}
      {nowX != null && (
        <line
          x1={nowX.toFixed(1)} y1={pad} x2={nowX.toFixed(1)} y2={height - pad}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
      )}
    </svg>
  );
}
