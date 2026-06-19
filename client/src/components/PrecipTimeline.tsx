import { useState, useMemo } from 'react';
import {
  ComposedChart, Area, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { PrecipTimelineResponse, SourceReading, WeatherAlert, LocalSensorReading } from '../types/weather';
import type { HourlyReading } from '../types/weather';

type Range = '1h' | '3h' | '6h' | '12h' | '24h' | '48h';
const RANGE_HOURS: Record<Range, number> = { '1h': 1, '3h': 3, '6h': 6, '12h': 12, '24h': 24, '48h': 48 };

interface DataPoint {
  time: string;
  prob: number;       // precipitation probability 0–100
  mm: number;         // expected precipitation mm
  intensity: number;  // mm/hr intensity (Tomorrow.io only)
}

const STORM_KEYWORDS = /thunderstorm|tornado|squall|cyclone|hurricane|severe|storm|wind|flood|hail/i;

function getActiveStormAlerts(alerts: WeatherAlert[] | undefined): WeatherAlert[] {
  if (!alerts?.length) return [];
  const now = Date.now();
  return alerts.filter(a => {
    const expired = a.expires && new Date(a.expires).getTime() < now;
    if (expired) return false;
    return a.severity === 'Severe' || a.severity === 'Extreme' || a.severity === 'Moderate' || STORM_KEYWORDS.test(a.event);
  });
}

interface Props {
  data: PrecipTimelineResponse;
  hours?: HourlyReading[];
  sources?: SourceReading[];
  alerts?: WeatherAlert[];
  localSensor?: LocalSensorReading;
}

function isMinuteLevel(minutes: { time: string }[]): boolean {
  if (minutes.length < 2) return false;
  return new Date(minutes[1].time).getTime() - new Date(minutes[0].time).getTime() < 5 * 60 * 1000;
}

function computeAvailableRanges(minutes: DataPoint[], hours: HourlyReading[] | undefined, isMinute: boolean): Range[] {
  const ranges: Range[] = [];
  if (isMinute) ranges.push('1h');
  const hourCount = hours ? hours.length : (isMinute ? 0 : minutes.length);
  if (hourCount >= 3)  ranges.push('3h');
  if (hourCount >= 6)  ranges.push('6h');
  if (hourCount >= 12) ranges.push('12h');
  if (hourCount >= 20) ranges.push('24h');
  if (hourCount >= 40) ranges.push('48h');
  if (ranges.length === 0) ranges.push('24h');
  return ranges;
}

function fmtTime(iso: string, rangeHours: number): string {
  const d = new Date(iso);
  if (rangeHours <= 1) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function fmtTooltipTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

function precipStatus(peak: number): { label: string; icon: string; color: string } {
  if (peak >= 80) return { label: 'Heavy rain expected',   icon: '⛈️', color: '#f87171' };
  if (peak >= 60) return { label: 'Rain likely',           icon: '🌧️', color: '#fb923c' };
  if (peak >= 30) return { label: 'Rain possible',         icon: '🌦️', color: '#fbbf24' };
  if (peak >= 15) return { label: 'Slight chance of rain', icon: '🌤️', color: '#93c5fd' };
  return            { label: 'No rain expected',           icon: '☀️',  color: '#34d399' };
}

function mmLabel(mm: number | undefined | null): string {
  const v = mm ?? 0;
  if (v <= 0)   return '< 0.1 mm';
  if (v < 0.1)  return `${(v * 10).toFixed(1)} mm`;
  return `${v.toFixed(1)} mm`;
}

function mmIntensityLabel(mm: number | undefined | null): string {
  const v = mm ?? 0;
  if (v < 0.1)  return 'Trace amounts';
  if (v < 2.5)  return 'Light rain';
  if (v < 10)   return 'Moderate rain';
  if (v < 50)   return 'Heavy rain';
  return 'Very heavy rain';
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DataPoint;
  const mm = (d.intensity > 0 ? d.intensity : d.mm) ?? 0;
  return (
    <div className="bg-gray-900/95 border border-white/15 rounded-xl px-3 py-2.5 text-xs shadow-2xl min-w-[140px]">
      <p className="text-white/50 font-medium mb-2">{fmtTooltipTime(d.time)}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/40">Probability</span>
          <span className="text-blue-300 font-bold">{d.prob}%</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-white/40">Expected</span>
          <span className="text-cyan-300 font-semibold">{mmLabel(mm)}</span>
        </div>
        {mm > 0 && (
          <p className="text-white/30 text-[10px] pt-0.5">{mmIntensityLabel(mm)}</p>
        )}
      </div>
    </div>
  );
};

export default function PrecipTimeline({ data, hours, sources, alerts, localSensor }: Props) {
  const minuteLevel = isMinuteLevel(data.minutes);

  const rawMinutes: DataPoint[] = useMemo(() => data.minutes.map(m => ({
    time: m.time,
    prob: m.precipProbability,
    mm: 0,
    intensity: m.precipIntensity,
  })), [data.minutes]);

  const availableRanges = useMemo(
    () => computeAvailableRanges(rawMinutes, hours, minuteLevel),
    [rawMinutes, hours, minuteLevel],
  );

  const defaultRange: Range = availableRanges.includes('24h') ? '24h' : availableRanges[availableRanges.length - 1] ?? '24h';
  const [range, setRange] = useState<Range>(defaultRange);
  const activeRange: Range = availableRanges.includes(range) ? range : defaultRange;
  const rangeHours = RANGE_HOURS[activeRange];

  const chartData = useMemo<DataPoint[]>(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + rangeHours * 60 * 60 * 1000);

    if (activeRange === '1h' && minuteLevel) {
      return rawMinutes.filter(m => {
        const t = new Date(m.time);
        return t >= now && t <= cutoff;
      });
    }

    if (hours) {
      return hours
        .filter(h => { const t = new Date(h.time); return t >= now && t <= cutoff; })
        .map(h => ({
          time: h.time,
          prob: h.precipitationProbability,
          mm: h.precipitationMm ?? 0,
          intensity: 0,
        }));
    }

    return rawMinutes.filter(m => new Date(m.time) <= cutoff);
  }, [activeRange, rangeHours, rawMinutes, hours, minuteLevel]);

  const activeStormAlerts = useMemo(() => getActiveStormAlerts(alerts), [alerts]);

  if (!chartData.length) return null;

  const peakProb = Math.max(...chartData.map(d => d.prob));
  const peakPoint = chartData.find(d => d.prob === peakProb);
  const status = precipStatus(peakProb);

  // Total expected mm across the range
  const totalMm = chartData.reduce((sum, d) => sum + (d.intensity > 0 ? d.intensity : d.mm), 0);
  const maxMm = Math.max(...chartData.map(d => d.intensity > 0 ? d.intensity : d.mm));

  // Rainy hours (≥ 30% probability)
  const rainyCount = chartData.filter(d => d.prob >= 30).length;
  const rainyLabel = minuteLevel && activeRange === '1h' ? `${rainyCount} min` : `${rainyCount}h`;

  // Which source is actually powering the chart for the active range
  const minuteSource = minuteLevel ? data.source : null;
  const chartSource = (activeRange === '1h' && minuteLevel) ? data.source : (hours ? 'Open-Meteo' : data.source);
  // True when switching ranges forces a source change (e.g. 1h=Tomorrow.io → 3h=Open-Meteo)
  const sourceChangedForRange = !!(minuteSource && chartSource !== minuteSource);

  // Source divergence: compare the MAX vs MIN precipitation probability across all sources.
  // NOTE: these are current-conditions snapshots from each provider's SourceReading,
  // not the timeline forecast itself. The 💧 values in the source breakdown are humidity.
  const sourcePrecipReadings = sources?.map(s => ({ name: s.source, prob: s.precipitationProbability })) ?? [];
  const sortedByProb = [...sourcePrecipReadings].sort((a, b) => b.prob - a.prob);
  const highestPrecipSource = sortedByProb[0];
  const lowestPrecipSource = sortedByProb[sortedByProb.length - 1];
  const hasSourceDivergence = !!(
    highestPrecipSource && lowestPrecipSource &&
    highestPrecipSource.name !== lowestPrecipSource.name &&
    highestPrecipSource.prob - lowestPrecipSource.prob >= 25
  );

  const tickFormatter = (t: string) => {
    const h = new Date(t).getHours();
    const m = new Date(t).getMinutes();
    if (rangeHours <= 1)  return m % 15 === 0 ? fmtTime(t, rangeHours) : '';
    if (rangeHours <= 6)  return fmtTime(t, rangeHours);
    if (rangeHours <= 12 && h % 3 === 0) return fmtTime(t, rangeHours);
    if (rangeHours <= 24 && h % 6 === 0) return fmtTime(t, rangeHours);
    if (rangeHours <= 48 && h % 8 === 0) return fmtTime(t, rangeHours);
    return '';
  };

  // Dynamic mm Y-axis ceiling — at least 2mm so bars aren't full-height on trace amounts
  const mmCeiling = Math.max(maxMm * 1.5, 2);
  const strokeColor = peakProb >= 60 ? '#60a5fa' : peakProb >= 30 ? '#93c5fd' : '#bfdbfe';
  const areaOpacity = peakProb >= 60 ? 0.6 : peakProb >= 30 ? 0.4 : 0.18;

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white/80 text-sm font-semibold">Rain Forecast</h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-base leading-none">{status.icon}</span>
            <span className="text-xs font-medium" style={{ color: status.color }}>{status.label}</span>
            {peakProb >= 15 && peakPoint && (
              <span className="text-white/25 text-xs">· peaks {fmtTime(peakPoint.time, rangeHours)}</span>
            )}
            {totalMm > 0.05 && (
              <span className="text-white/30 text-xs">· ~{mmLabel(totalMm)} total</span>
            )}
          </div>
          {data.fallback && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-amber-400/70 bg-amber-400/10 border border-amber-400/15 rounded-full px-2 py-0.5">
              ⚡ Hourly estimates
            </span>
          )}
        </div>

        {/* Range selector */}
        <div className="flex gap-0.5 bg-white/8 rounded-lg p-0.5 shrink-0">
          {availableRanges.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                activeRange === r ? 'bg-blue-500/30 text-blue-300' : 'text-white/35 hover:text-white/60'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Source switch notice — shown when changing ranges silently changes the data source */}
      {sourceChangedForRange && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
          <span className="text-white/40 text-sm shrink-0">ℹ</span>
          <p className="text-white/50 text-xs leading-relaxed">
            Ranges beyond 1h switch to <span className="text-white/70 font-medium">{chartSource}</span> hourly
            data — the 1h view uses <span className="text-white/70 font-medium">{minuteSource}</span> minute-level
            data and may disagree.
          </p>
        </div>
      )}

      {/* Source divergence warning — compares current-conditions precipitation probability across all sources */}
      {hasSourceDivergence && highestPrecipSource && lowestPrecipSource && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-400/8 border border-amber-400/20 px-3 py-2">
          <span className="text-amber-400 text-sm shrink-0">⚠</span>
          <p className="text-amber-300/80 text-xs leading-relaxed">
            Sources disagree on current rain probability —{' '}
            <span className="font-semibold text-amber-300">{highestPrecipSource.name}</span> shows{' '}
            <span className="font-semibold text-amber-300">{highestPrecipSource.prob}%</span> while{' '}
            <span className="font-semibold text-amber-300">{lowestPrecipSource.name}</span> shows{' '}
            <span className="font-semibold text-amber-300">{lowestPrecipSource.prob}%</span>.
          </p>
        </div>
      )}

      {/* Sensor rain notice — shown when nearby Netatmo stations detect active precipitation */}
      {localSensor?.rainRateMmhr != null && localSensor.rainRateMmhr > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-emerald-500/8 border border-emerald-400/20 px-3 py-2">
          <span className="text-emerald-400 text-sm shrink-0">📡</span>
          <p className="text-emerald-300/80 text-xs leading-relaxed">
            {localSensor.rainStationCount ?? localSensor.stationCount} nearby sensor{(localSensor.rainStationCount ?? localSensor.stationCount) > 1 ? 's' : ''} detect active rain —{' '}
            <span className="font-semibold">{localSensor.rainRateMmhr.toFixed(1)} mm/hr</span>
            {localSensor.rain1h != null && `, ${localSensor.rain1h.toFixed(1)} mm measured last hour`}.
          </p>
        </div>
      )}

      {/* Official alert notice — shown when active warnings contradict the forecast chart */}
      {activeStormAlerts.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-400/25 px-3 py-2.5">
          <span className="text-red-400 text-base shrink-0 mt-0.5">⚠️</span>
          <div className="min-w-0">
            <p className="text-red-300 text-xs font-semibold leading-snug">
              Official weather alerts are active — conditions may be more severe than shown below
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {activeStormAlerts.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-400/20 text-red-300/80"
                >
                  <span className="font-medium capitalize">{a.severity}</span>
                  <span className="text-red-400/50">·</span>
                  <span>{a.event}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chart — dual axis: probability (left) + mm (right) */}
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={chartData} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="precipProbGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={strokeColor} stopOpacity={areaOpacity} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="time"
            tickFormatter={tickFormatter}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          {/* Left: probability % */}
          <YAxis
            yAxisId="prob"
            domain={[0, 100]}
            ticks={[0, 30, 60, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          {/* Right: mm — hidden axis, just used for bar scaling */}
          <YAxis
            yAxisId="mm"
            orientation="right"
            domain={[0, mmCeiling]}
            hide
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
          />

          {/* Threshold reference lines */}
          <ReferenceLine yAxisId="prob" y={30} stroke="rgba(251,191,36,0.2)"  strokeDasharray="4 3" />
          <ReferenceLine yAxisId="prob" y={60} stroke="rgba(251,146,60,0.25)" strokeDasharray="4 3" />

          {/* mm bars — shown behind probability area */}
          <Bar
            yAxisId="mm"
            dataKey={d => (d.intensity > 0 ? d.intensity : d.mm) ?? 0}
            name="Rainfall (mm)"
            fill="rgba(103,232,249,0.35)"
            radius={[2, 2, 0, 0]}
            maxBarSize={20}
          />

          {/* Probability area — on top */}
          <Area
            yAxisId="prob"
            type="monotone"
            dataKey="prob"
            name="Probability"
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#precipProbGrad)"
            dot={false}
            activeDot={{ r: 4, fill: strokeColor, stroke: 'rgba(255,255,255,0.6)', strokeWidth: 1.5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Stats row */}
      <div className="flex flex-wrap items-center mt-3 pt-3 border-t border-white/8 text-center gap-y-2 [&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-white/8">
        <div className="flex-1 px-2">
          <p className="text-white/25 text-[10px] uppercase tracking-wider mb-0.5">Peak chance</p>
          <p className="text-sm font-semibold" style={{ color: status.color }}>{peakProb}%</p>
        </div>

        <div className="flex-1 px-2">
          <p className="text-white/25 text-[10px] uppercase tracking-wider mb-0.5">Total rain</p>
          <p className="text-white/80 text-sm font-semibold">
            {totalMm < 0.05 ? 'None' : mmLabel(totalMm)}
          </p>
        </div>

        {maxMm > 0.05 && (
          <div className="flex-1 px-2">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-0.5">Intensity</p>
            <p className="text-white/80 text-sm font-semibold">{mmIntensityLabel(maxMm)}</p>
          </div>
        )}

        {rainyCount > 0 && (
          <div className="flex-1 px-2">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-0.5">Rain hours</p>
            <p className="text-white/80 text-sm font-semibold">{rainyLabel}</p>
          </div>
        )}

        {localSensor?.rain1h != null && (
          <div className="flex-1 px-2">
            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-0.5">Sensor (1h)</p>
            <p className="text-emerald-300/80 text-sm font-semibold">
              {localSensor.rain1h > 0 ? `${localSensor.rain1h.toFixed(1)} mm` : 'None'}
            </p>
          </div>
        )}

        <div className="flex-1 px-2">
          <p className="text-white/20 text-[10px] uppercase tracking-wider mb-0.5">Source</p>
          <p className="text-white/30 text-xs truncate">{chartSource}</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3 text-[10px] text-white/25">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-2 rounded-sm bg-cyan-300/35" />
          Expected rainfall (mm)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 border-t-2" style={{ borderColor: strokeColor }} />
          Probability
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <span className="inline-block w-4 border-t border-dashed border-yellow-400/30" /> 30%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-dashed border-orange-400/35" /> 60%
        </span>
      </div>
    </div>
  );
}
