
interface Props {
  spread: number;
  message: string;
}

export default function DisputeBadge({ spread, message }: Props) {
  const isHigh = spread > 5;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
        isHigh
          ? 'bg-red-500/15 border-red-400/40 text-red-300'
          : 'bg-amber-500/15 border-amber-400/40 text-amber-300'
      }`}
    >
      <span className="text-xl mt-0.5" role="img" aria-label="warning">
        {isHigh ? '🔴' : '⚠️'}
      </span>
      <div>
        <p className="font-semibold text-sm">
          {isHigh ? 'High Uncertainty' : 'Forecast Disputed'}
          <span className="ml-2 font-normal opacity-75">({spread.toFixed(1)}°C spread)</span>
        </p>
        <p className="text-sm opacity-85 mt-0.5">{message}</p>
      </div>
    </div>
  );
}
