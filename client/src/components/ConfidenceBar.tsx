import { confidenceLabel } from '../utils/formatters';

interface Props {
  score: number;
}

export default function ConfidenceBar({ score }: Props) {
  const label = confidenceLabel(score);

  const barColor =
    score >= 80
      ? 'bg-emerald-400'
      : score >= 60
      ? 'bg-yellow-400'
      : score >= 40
      ? 'bg-orange-400'
      : 'bg-red-500';

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-white/60 font-medium uppercase tracking-wider">Source Agreement</span>
        <span className="text-xs font-semibold text-white/80">{label} · {score}%</span>
      </div>

      {/* Bar with zone markers */}
      <div className="relative h-2 w-full bg-white/10 rounded-full overflow-visible">
        {/* Fill */}
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${score}%` }}
        />
        {/* Zone tick at 40% */}
        <div className="absolute top-0 bottom-0 w-px bg-white/25" style={{ left: '40%' }} />
        {/* Zone tick at 80% */}
        <div className="absolute top-0 bottom-0 w-px bg-white/25" style={{ left: '80%' }} />
      </div>

      {/* Zone labels */}
      <div className="flex text-[10px] text-white/25 mt-1 px-0.5">
        <span style={{ width: '40%' }}>Low</span>
        <span style={{ width: '40%' }} className="text-center">Moderate</span>
        <span style={{ width: '20%' }} className="text-right">High</span>
      </div>
    </div>
  );
}
