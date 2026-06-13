import type { AccuracyResponse } from '../types/weather';

interface Props {
  accuracy: AccuracyResponse;
}

const SOURCE_ICONS: Record<string, string> = {
  'Open-Meteo': '🌐',
  'OpenWeatherMap': '🗺️',
  'Tomorrow.io': '🔭',
  'WeatherAPI': '📡',
};

function AccuracyRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;
  const color =
    score >= 80 ? '#34d399' :
    score >= 60 ? '#facc15' :
    score >= 40 ? '#fb923c' : '#f87171';

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={5} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth={5} fill="none"
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AccuracyLeaderboard({ accuracy }: Props) {
  if (!accuracy.sources.length) {
    return (
      <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🏆</span>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Source Scorecard</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-white/40 text-sm">No track record yet for {accuracy.location}</p>
          <p className="text-white/25 text-xs mt-2 leading-relaxed max-w-xs mx-auto">
            WeatherWise stores every forecast and compares it to what actually happened.
            Check back in 24–48 hours — your local scorecard will appear here.
          </p>
          <div className="mt-4 flex justify-center gap-6 text-white/20 text-xs">
            <span>Requires DATABASE_URL</span>
          </div>
        </div>
      </div>
    );
  }

  const sorted = [...accuracy.sources].sort((a, b) => b.accuracyScore - a.accuracyScore);
  const leader = sorted[0];
  const totalSamples = Math.max(...sorted.map(s => s.sampleCount));
  const monthEstimate = Math.ceil(totalSamples / 30);

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-base">🏆</span>
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Source Scorecard</h2>
          </div>
          <p className="text-white/40 text-xs">
            Who actually gets {accuracy.location} right — based on {totalSamples} day{totalSamples !== 1 ? 's' : ''} of tracking
          </p>
        </div>
        {accuracy.usingDynamicWeights && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
            Dynamic weights on
          </span>
        )}
      </div>

      {/* Leader callout */}
      {leader && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
          <AccuracyRing score={leader.accuracyScore} size={52} />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">
              {SOURCE_ICONS[leader.source] ?? '📊'} {leader.source}
            </p>
            <p className="text-white/70 text-xs mt-0.5">
              Got it right <span className="text-emerald-400 font-bold">{leader.accuracyScore}%</span> of the time in {accuracy.location}
              {monthEstimate > 0 ? ` over the past ${monthEstimate > 1 ? `${monthEstimate} months` : 'month'}` : ''}
            </p>
            <p className="text-white/30 text-xs mt-0.5">±{leader.mae.toFixed(1)}°C error · weight ×{leader.weight.toFixed(2)}</p>
          </div>
          <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-2.5 py-0.5 shrink-0">
            #1
          </span>
        </div>
      )}

      {/* Full leaderboard */}
      <div className="space-y-2">
        {sorted.map((s, i) => {
          const barColor =
            s.accuracyScore >= 80 ? 'bg-emerald-400' :
            s.accuracyScore >= 60 ? 'bg-yellow-400' :
            s.accuracyScore >= 40 ? 'bg-orange-400' : 'bg-red-500';

          return (
            <div key={s.source} className="flex items-center gap-3">
              <span className="text-xs text-white/25 font-mono w-4 text-center">#{i + 1}</span>
              <span className="text-sm w-5 text-center">{SOURCE_ICONS[s.source] ?? '📊'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-white/80 truncate">{s.source}</span>
                  <span className="text-xs text-white/40 ml-2 shrink-0">
                    {s.sampleCount} day{s.sampleCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-white/8 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${s.accuracyScore}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-white/70 w-8 text-right shrink-0">{s.accuracyScore}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-white/20 text-xs pt-1 border-t border-white/8 leading-relaxed">
        Accuracy = daily high/low vs Open-Meteo historical actuals. Higher score → higher weight in your consensus temperature.
        No other consumer weather app publishes this per city.
      </p>
    </div>
  );
}
