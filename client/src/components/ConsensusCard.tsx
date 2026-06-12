import type { ConsensusReading } from '../types/weather';
import { formatTemp, conditionCodeToEmoji } from '../utils/formatters';
import ConfidenceBar from './ConfidenceBar';
import DisputeBadge from './DisputeBadge';

interface Props {
  consensus: ConsensusReading;
  location: string;
  unit: 'C' | 'F';
}

export default function ConsensusCard({ consensus, location, unit }: Props) {
  const mainIcon = conditionCodeToEmoji(consensus.sources[0]?.conditionCode ?? 'unknown');

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-6 space-y-5">
      {/* Location */}
      <div className="flex items-center gap-2 text-white/60 text-sm">
        <span>📍</span>
        <span className="font-medium">{location}</span>
        {consensus.sources.length > 0 && (
          <span className="ml-auto text-xs opacity-60">
            {consensus.sources.length} source{consensus.sources.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Hero temperature */}
      <div className="flex items-center gap-4">
        <span className="text-7xl leading-none" role="img" aria-label={consensus.condition}>
          {mainIcon}
        </span>
        <div>
          <div className="text-6xl font-light tracking-tight text-white">
            {formatTemp(consensus.temperature, unit)}
          </div>
          <div className="text-white/70 text-lg mt-1">{consensus.condition}</div>
        </div>
      </div>

      {/* Confidence bar */}
      <ConfidenceBar score={consensus.confidenceScore} />

      {/* Dispute badge — only when disputed */}
      {consensus.isDisputed && (
        <DisputeBadge spread={consensus.spread} message={consensus.disputeMessage} />
      )}

      {!consensus.isDisputed && (
        <p className="text-sm text-emerald-400/80 flex items-center gap-2">
          <span>✓</span>
          {consensus.disputeMessage}
        </p>
      )}
    </div>
  );
}
