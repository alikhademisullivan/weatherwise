import type { AccuracyResponse } from '../types/weather';

interface Props {
  accuracy: AccuracyResponse;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-400' :
    score >= 60 ? 'bg-yellow-400' :
    score >= 40 ? 'bg-orange-400' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-white/70 w-8 text-right">{score}%</span>
    </div>
  );
}

export default function AccuracyLeaderboard({ accuracy }: Props) {
  if (!accuracy.sources.length) {
    return (
      <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-6">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Source Accuracy</h2>
        <div className="text-center py-4">
          <p className="text-white/40 text-sm">No accuracy data yet</p>
          <p className="text-white/30 text-xs mt-1">
            Data accumulates after forecasts are made and compared against actuals (requires DATABASE_URL).
            Check back after 24–48 hours.
          </p>
        </div>
      </div>
    );
  }

  const sorted = [...accuracy.sources].sort((a, b) => b.accuracyScore - a.accuracyScore);

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Source Accuracy</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          Dynamic Weights Active
        </span>
      </div>

      <div className="space-y-3">
        {sorted.map((s, i) => (
          <div key={s.source} className="flex items-center gap-3">
            {/* Rank */}
            <span className="text-xs text-white/30 w-4 text-center font-mono">#{i + 1}</span>

            {/* Source name + meta */}
            <div className="w-32 shrink-0">
              <p className="text-sm font-medium text-white">{s.source}</p>
              <p className="text-xs text-white/40">
                ±{s.mae.toFixed(1)}°C · {s.sampleCount} day{s.sampleCount !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Score bar */}
            <ScoreBar score={s.accuracyScore} />

            {/* Weight pill */}
            <span className="text-xs text-white/50 w-12 text-right">
              ×{s.weight.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-white/30 text-xs mt-4 pt-3 border-t border-white/10">
        Accuracy = 30-day rolling MAE vs Open-Meteo historical data.
        Lower error → higher weight in consensus temperature.
      </p>
    </div>
  );
}
