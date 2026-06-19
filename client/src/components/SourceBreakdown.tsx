import type { SourceReading, ConsensusReading, SourceAccuracy, LocalSensorReading } from '../types/weather';
import { formatTemp, formatTime, formatWind } from '../utils/formatters';

interface Props {
  sources: SourceReading[];
  consensus: ConsensusReading;
  accuracy: SourceAccuracy[];
  unit: 'C' | 'F';
  onViewScorecard?: () => void;
  localSensor?: LocalSensorReading;
}

function outlierIndex(sources: SourceReading[], consensus: ConsensusReading): number {
  let maxDiff = -1;
  let idx = -1;
  sources.forEach((s, i) => {
    const diff = Math.abs(s.temperature - consensus.temperature);
    if (diff > maxDiff) { maxDiff = diff; idx = i; }
  });
  return idx;
}

export default function SourceBreakdown({ sources, consensus, accuracy, unit, onViewScorecard, localSensor }: Props) {
  const outlier = outlierIndex(sources, consensus);
  const accuracyBySource = Object.fromEntries(accuracy.map(a => [a.source, a]));

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-5">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Source Breakdown</h2>
      <div className="space-y-3">
        {sources.map((s, i) => {
          const diff = parseFloat((s.temperature - consensus.temperature).toFixed(1));
          const isOutlier = i === outlier && sources.length > 1;
          const acc = accuracyBySource[s.source];

          return (
            <div
              key={s.source}
              className={`flex items-center gap-3 rounded-xl p-3 border ${
                isOutlier
                  ? 'bg-amber-500/10 border-amber-400/30'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-white">{s.source}</span>
                  {isOutlier && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      outlier
                    </span>
                  )}
                  {acc && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/50 border border-white/10">
                      {acc.accuracyScore}% acc · ×{acc.weight.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/40 mt-0.5">{s.condition} · {formatTime(s.fetchedAt)}</div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-white font-semibold">{formatTemp(s.temperature, unit)}</div>
                <div className={`text-xs ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-blue-400' : 'text-white/40'}`}>
                  {diff > 0 ? '+' : ''}{diff !== 0 ? `${diff}° vs avg` : 'on avg'}
                </div>
              </div>

              <div className="hidden sm:flex flex-col items-end text-xs text-white/40 w-20 shrink-0">
                <span>💧 {s.humidity}%</span>
                <span>💨 {formatWind(s.windSpeed, unit)}</span>
              </div>
            </div>
          );
        })}

        {/* Netatmo personal weather station row — visually distinct from model sources */}
        {localSensor && (() => {
          const diff = parseFloat((localSensor.temperature - consensus.temperature).toFixed(1));
          const distLabel = localSensor.nearestKm < 1
            ? `${Math.round(localSensor.nearestKm * 1000)}m`
            : `${localSensor.nearestKm.toFixed(1)}km`;
          return (
            <div className="flex items-center gap-3 rounded-xl p-3 border bg-emerald-500/5 border-emerald-400/20">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-emerald-300">📡 Netatmo</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-300/60 border border-emerald-400/15">
                    {localSensor.stationCount} station{localSensor.stationCount > 1 ? 's' : ''} · {distLabel}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/8 text-white/35 border border-white/10">
                    live sensor
                  </span>
                </div>
                <div className="text-xs text-white/40 mt-0.5">
                  Personal weather stations · {formatTime(localSensor.fetchedAt)}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-emerald-200 font-semibold">{formatTemp(localSensor.temperature, unit)}</div>
                <div className={`text-xs ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-blue-400' : 'text-white/40'}`}>
                  {diff > 0 ? '+' : ''}{diff !== 0 ? `${diff}° vs avg` : 'on avg'}
                </div>
              </div>

              <div className="hidden sm:flex flex-col items-end text-xs text-white/40 w-20 shrink-0">
                {localSensor.humidity != null && <span>💧 {localSensor.humidity}%</span>}
                {localSensor.rain1h != null
                  ? <span>🌧 {localSensor.rain1h.toFixed(1)}mm/h</span>
                  : localSensor.windSpeed != null
                  ? <span>💨 {formatWind(localSensor.windSpeed, unit)}</span>
                  : null
                }
              </div>
            </div>
          );
        })()}
      </div>

      {onViewScorecard && (
        <button
          onClick={onViewScorecard}
          className="mt-3 w-full text-xs text-white/35 hover:text-white/60 py-1.5 transition-colors text-center"
        >
          View source accuracy scorecard →
        </button>
      )}
    </div>
  );
}
