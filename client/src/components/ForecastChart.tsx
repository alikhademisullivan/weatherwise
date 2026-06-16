import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { ForecastDay } from '../types/weather';
import { formatDate, celsiusToFahrenheit, conditionCodeToEmoji } from '../utils/formatters';

interface Props {
  forecast: ForecastDay[];
  unit: 'C' | 'F';
  days?: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const d = payload[0].payload as ForecastDay & { high: number; low: number; label: string };
  const tier = d.confidenceTier ?? 'high';

  return (
    <div className="bg-slate-800/95 border border-white/15 rounded-xl px-4 py-3 text-sm shadow-xl">
      <p className="font-semibold text-white mb-1">{formatDate(d.date)}</p>

      {tier === 'high' && (
        <>
          <p className="text-red-300">H: {Math.round(d.high)}°</p>
          <p className="text-blue-300">L: {Math.round(d.low)}°</p>
        </>
      )}
      {tier === 'medium' && (
        <>
          <p className="text-white/60">Range: {d.tempRangeLow}°–{d.tempRangeHigh}°</p>
          <p className="text-white/40 text-xs">±{Math.round(((d.tempRangeHigh ?? d.high) - (d.tempRangeLow ?? d.low)) / 2)}° uncertainty</p>
        </>
      )}
      {tier === 'low' && (
        <p className="text-white/50 italic text-xs">{d.trend ?? 'Extended outlook only'}</p>
      )}

      <p className="text-cyan-300">Rain: {d.precipitationProbability}%</p>
      {d.isDisputed && <p className="text-amber-300 mt-1">⚠ Disputed</p>}

      <p className={`text-xs mt-1.5 ${
        tier === 'high' ? 'text-emerald-400/60' :
        tier === 'medium' ? 'text-yellow-400/60' : 'text-red-400/60'
      }`}>
        {tier === 'high' ? '● High confidence' : tier === 'medium' ? '◐ Moderate uncertainty' : '○ Low confidence — trend only'}
      </p>

      {tier !== 'high' && (
        <p className="text-white/30 text-xs mt-1 border-t border-white/10 pt-1">
          Why? Sources spread {Math.round((d.spreadHigh ?? d.high) - (d.spreadLow ?? d.low))}° apart on this day
        </p>
      )}
    </div>
  );
}

const TIER_LEGEND = [
  { tier: 'high', label: 'Days 1–3: High confidence', color: 'bg-emerald-400' },
  { tier: 'medium', label: 'Days 4–6: Range shown', color: 'bg-yellow-400' },
  { tier: 'low', label: 'Days 7–14: Trend only', color: 'bg-red-400/60' },
];

export default function ForecastChart({ forecast, unit, days }: Props) {
  const convert = (v: number) => unit === 'F' ? celsiusToFahrenheit(v) : v;

  const data = forecast.map(d => ({
    ...d,
    label: formatDate(d.date).split(',')[0],
    high: parseFloat(convert(d.high).toFixed(1)),
    low: parseFloat(convert(d.low).toFixed(1)),
    spreadHigh: parseFloat(convert(d.spreadHigh).toFixed(1)),
    spreadLow: parseFloat(convert(d.spreadLow).toFixed(1)),
    tempRangeHigh: d.tempRangeHigh != null ? parseFloat(convert(d.tempRangeHigh).toFixed(1)) : undefined,
    tempRangeLow: d.tempRangeLow != null ? parseFloat(convert(d.tempRangeLow).toFixed(1)) : undefined,
    // Uncertainty band: widens by day index
    bandHigh: d.confidenceTier === 'medium'
      ? parseFloat(convert(d.spreadHigh).toFixed(1))
      : d.confidenceTier === 'low'
      ? parseFloat(convert(d.spreadHigh + 1).toFixed(1))
      : undefined,
    bandLow: d.confidenceTier === 'medium'
      ? parseFloat(convert(d.spreadLow).toFixed(1))
      : d.confidenceTier === 'low'
      ? parseFloat(convert(d.spreadLow - 1).toFixed(1))
      : undefined,
  }));

  // Split transition index between high→medium
  const mediumStartIdx = data.findIndex(d => d.confidenceTier === 'medium');
  const lowStartIdx = data.findIndex(d => d.confidenceTier === 'low');
  const mediumLabel = mediumStartIdx >= 0 ? data[mediumStartIdx].label : null;
  const lowLabel = lowStartIdx >= 0 ? data[lowStartIdx].label : null;

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-6 space-y-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">{days ?? 7}-Day Forecast</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end">
          {TIER_LEGEND.map(t => (
            <span key={t.tier} className="flex items-center gap-1 text-xs text-white/40">
              <span className={`w-2 h-2 rounded-full ${t.color}`} />
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* Day strip — different display by tier */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.min(forecast.length, 14)}, minmax(0, 1fr))` }}
      >
        {forecast.map(d => {
          const tier = d.confidenceTier ?? 'high';
          const hi = Math.round(convert(d.high));
          const lo = Math.round(convert(d.low));
          const rangeHi = d.tempRangeHigh != null ? Math.round(convert(d.tempRangeHigh)) : null;
          const rangeLo = d.tempRangeLow != null ? Math.round(convert(d.tempRangeLow)) : null;

          return (
            <div
              key={d.date}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 px-1 transition-colors ${
                tier === 'high' ? 'bg-white/5' :
                tier === 'medium' ? 'bg-yellow-400/5 border border-yellow-400/10' :
                'bg-red-400/5 border border-red-400/10'
              }`}
            >
              <span className={`text-xs font-medium ${
                tier === 'high' ? 'text-white/50' :
                tier === 'medium' ? 'text-yellow-400/60' : 'text-red-400/50'
              }`}>
                {formatDate(d.date).split(',')[0]}
              </span>

              {tier === 'low' ? (
                <span className="text-base opacity-40" title={d.trend}>
                  {conditionCodeToEmoji(d.conditionCode ?? d.condition)}
                </span>
              ) : (
                <span className="text-lg">{conditionCodeToEmoji(d.conditionCode ?? d.condition)}</span>
              )}

              {tier === 'high' && (
                <>
                  <span className="text-xs font-semibold text-white">{hi}°</span>
                  <span className="text-xs text-white/40">{lo}°</span>
                </>
              )}

              {tier === 'medium' && (
                <>
                  <span className="text-xs font-medium text-yellow-200/80">{rangeLo}–{rangeHi}°</span>
                  <span className="text-xs text-yellow-400/40">range</span>
                </>
              )}

              {tier === 'low' && (
                <span className="text-xs text-red-400/50 text-center leading-tight">{d.trend?.split(',')[0] ?? '?'}</span>
              )}

              {d.isDisputed && tier === 'high' && (
                <span className="text-xs text-amber-400" title="Disputed">⚠</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart with uncertainty bands */}
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} unit="°" />
          <Tooltip content={<CustomTooltip />} />

          {/* Uncertainty band for medium+low days */}
          <Area
            type="monotone"
            dataKey="bandHigh"
            stroke="none"
            fill="rgba(250,204,21,0.08)"
            fillOpacity={1}
            legendType="none"
            connectNulls={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="bandLow"
            stroke="none"
            fill="rgba(255,255,255,0)"
            fillOpacity={0}
            legendType="none"
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Rain bars */}
          <Area
            type="monotone"
            dataKey="precipitationProbability"
            name="Rain %"
            fill="rgba(56,189,248,0.12)"
            stroke="rgba(56,189,248,0.3)"
            strokeWidth={1}
            dot={false}
            legendType="none"
            yAxisId={0}
          />

          {/* High line — solid for high-confidence, dashed for lower */}
          <Line
            type="monotone"
            dataKey="high"
            name="High"
            stroke="#f87171"
            strokeWidth={2}
            dot={false}
            strokeDasharray="0"
          />
          <Line
            type="monotone"
            dataKey="low"
            name="Low"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
          />

          {/* Confidence boundary markers */}
          {mediumLabel && (
            <ReferenceLine x={mediumLabel} stroke="rgba(250,204,21,0.3)" strokeDasharray="4 4" label={{ value: 'uncertain →', position: 'top', fill: 'rgba(250,204,21,0.4)', fontSize: 9 }} />
          )}
          {lowLabel && (
            <ReferenceLine x={lowLabel} stroke="rgba(248,113,113,0.3)" strokeDasharray="4 4" label={{ value: 'trend only →', position: 'top', fill: 'rgba(248,113,113,0.4)', fontSize: 9 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-white/25 text-xs text-center">
        WeatherWise is honest about forecast limits — precision drops significantly beyond 3 days.
      </p>
    </div>
  );
}
