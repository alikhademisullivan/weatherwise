import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { HourlyReading } from '../types/weather';
import { celsiusToFahrenheit, conditionCodeToEmoji, formatWind } from '../utils/formatters';

interface Props {
  hours: HourlyReading[];
  unit: 'C' | 'F';
}

function formatHour(isoTime: string) {
  return new Date(isoTime).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function CustomTooltip({ active, payload, unit }: { active?: boolean; payload?: any[]; unit?: 'C' | 'F' }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as HourlyReading & { label: string; temp: number };
  return (
    <div className="bg-slate-800/95 border border-white/15 rounded-xl px-4 py-3 text-sm shadow-xl">
      <p className="font-semibold text-white mb-1">{d.label}</p>
      <p className="text-orange-300">{conditionCodeToEmoji(d.conditionCode)} {d.condition}</p>
      <p className="text-white">{Math.round(d.temp)}°</p>
      <p className="text-cyan-300">Rain: {d.precipitationProbability}%</p>
      <p className="text-white/60">Wind: {formatWind(d.windSpeed, unit ?? 'C')}</p>
    </div>
  );
}

export default function HourlyChart({ hours, unit }: Props) {
  const convert = (v: number) => unit === 'F' ? celsiusToFahrenheit(v) : v;

  const data = hours.map(h => ({
    ...h,
    label: formatHour(h.time),
    temp: parseFloat(convert(h.temperature).toFixed(1)),
  }));

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-6">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">24-Hour Forecast</h2>

      {/* Scrollable hour strip */}
      <div className="flex gap-3 overflow-x-auto pb-3 mb-4 scrollbar-thin">
        {hours.slice(0, 12).map(h => (
          <div key={h.time} className="flex flex-col items-center gap-1 min-w-[48px]">
            <span className="text-xs text-white/50 whitespace-nowrap">{formatHour(h.time)}</span>
            <span className="text-base">{conditionCodeToEmoji(h.conditionCode)}</span>
            <span className="text-xs font-medium text-white">{Math.round(convert(h.temperature))}°</span>
            <span className="text-xs text-cyan-400">{h.precipitationProbability}%</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} unit="°" />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
          <Bar dataKey="precipitationProbability" name="Rain %" fill="rgba(56,189,248,0.2)" radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="temp" name="Temp" stroke="#fb923c" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
