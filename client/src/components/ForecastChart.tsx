import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { ForecastDay } from '../types/weather';
import { formatDate, celsiusToFahrenheit, conditionCodeToEmoji } from '../utils/formatters';

interface Props {
  forecast: ForecastDay[];
  unit: 'C' | 'F';
}

interface TooltipPayload {
  payload?: {
    date: string;
    high: number;
    low: number;
    spreadHigh: number;
    spreadLow: number;
    precipitationProbability: number;
    condition: string;
    isDisputed: boolean;
  };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-800/95 border border-white/15 rounded-xl px-4 py-3 text-sm shadow-xl">
      <p className="font-semibold text-white mb-1">{formatDate(d.date)}</p>
      <p className="text-red-300">H: {Math.round(d.high)}°</p>
      <p className="text-blue-300">L: {Math.round(d.low)}°</p>
      <p className="text-white/60">Spread: {Math.round(d.spreadLow)}° – {Math.round(d.spreadHigh)}°</p>
      <p className="text-cyan-300">Rain: {d.precipitationProbability}%</p>
      {d.isDisputed && <p className="text-amber-300 mt-1">⚠ Disputed</p>}
    </div>
  );
}

export default function ForecastChart({ forecast, unit }: Props) {
  const convert = (v: number) => unit === 'F' ? celsiusToFahrenheit(v) : v;

  const data = forecast.map(d => ({
    ...d,
    label: formatDate(d.date).split(',')[0],
    high: parseFloat(convert(d.high).toFixed(1)),
    low: parseFloat(convert(d.low).toFixed(1)),
    spreadHigh: parseFloat(convert(d.spreadHigh).toFixed(1)),
    spreadLow: parseFloat(convert(d.spreadLow).toFixed(1)),
  }));

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-6">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">7-Day Forecast</h2>

      {/* Day strip */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {forecast.map(d => (
          <div key={d.date} className="flex flex-col items-center gap-1">
            <span className="text-xs text-white/50">{formatDate(d.date).split(',')[0]}</span>
            <span className="text-lg">{conditionCodeToEmoji('partly_cloudy')}</span>
            <span className="text-xs font-medium text-white">{Math.round(convert(d.high))}°</span>
            <span className="text-xs text-white/50">{Math.round(convert(d.low))}°</span>
            {d.isDisputed && <span className="text-xs text-amber-400" title="Disputed">⚠</span>}
          </div>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} unit="°" />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
          <Bar dataKey="precipitationProbability" name="Rain %" fill="rgba(56,189,248,0.25)" radius={[4, 4, 0, 0]} yAxisId={0} />
          <Line type="monotone" dataKey="high" name="High" stroke="#f87171" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="low" name="Low" stroke="#60a5fa" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
