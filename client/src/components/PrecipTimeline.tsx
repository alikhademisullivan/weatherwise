import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { PrecipTimelineResponse } from '../types/weather';

interface Props {
  data: PrecipTimelineResponse;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function precipColor(prob: number): string {
  if (prob >= 70) return '#60a5fa'; // blue-400
  if (prob >= 40) return '#93c5fd'; // blue-300
  if (prob >= 15) return '#bfdbfe'; // blue-200
  return '#dbeafe';                  // blue-100
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-900/90 border border-white/15 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-medium">{formatTime(d.time)}</p>
      <p className="text-blue-300">{d.precipProbability}% chance of rain</p>
      {d.precipIntensity > 0 && (
        <p className="text-white/50">{d.precipIntensity.toFixed(2)} mm/hr</p>
      )}
    </div>
  );
};

export default function PrecipTimeline({ data }: Props) {
  if (!data.minutes.length) return null;

  const chartData = data.minutes;

  if (!chartData.length) return null;

  const anyRain = chartData.some(m => m.precipProbability >= 15);
  const peakProb = Math.max(...chartData.map(m => m.precipProbability));
  const subtitle = anyRain ? `Peak chance: ${peakProb}%` : 'No rain expected';

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm px-5 py-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white/80 text-sm font-semibold">Precipitation — Next 24h</h3>
          <p className="text-white/40 text-xs mt-0.5">{subtitle}</p>
          {data.fallback && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
              ⚡ Showing hourly estimates — minute data temporarily unavailable
            </span>
          )}
        </div>
        <span className="text-2xl">{peakProb >= 70 ? '🌧️' : peakProb >= 30 ? '🌦️' : '☀️'}</span>
      </div>

      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }} barCategoryGap="8%">
          <XAxis
            dataKey="time"
            tickFormatter={t => {
              const h = new Date(t).getHours();
              // Label at 12 AM, 6 AM, 12 PM, 6 PM — four clean anchors across 24 h
              if (h !== 0 && h !== 6 && h !== 12 && h !== 18) return '';
              return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
            }}
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis domain={[0, 100]} hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="precipProbability" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={precipColor(entry.precipProbability)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
