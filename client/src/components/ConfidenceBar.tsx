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
      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
