
interface Props {
  spread: number;   // always in °C from API
  message: string;
  unit?: 'C' | 'F';
}

export default function DisputeBadge({ spread, message, unit = 'C' }: Props) {
  // G1.3: convert spread to display unit
  const displaySpread = unit === 'F' ? spread * 9 / 5 : spread;
  const unitLabel = `°${unit}`;
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
          <span className="ml-2 font-normal opacity-75">
            ({displaySpread.toFixed(1)}{unitLabel} spread)
          </span>
        </p>
        <p className="text-sm opacity-85 mt-0.5">{message}</p>
        {/* G3.14: action hint */}
        <p className="text-xs opacity-55 mt-1.5">
          Check back in an hour — sources often converge as the day progresses.
        </p>
      </div>
    </div>
  );
}
