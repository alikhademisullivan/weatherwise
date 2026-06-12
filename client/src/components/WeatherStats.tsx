import type { ConsensusReading } from '../types/weather';
import { formatTemp } from '../utils/formatters';

interface Props {
  consensus: ConsensusReading;
  unit: 'C' | 'F';
}

interface StatProps {
  icon: string;
  label: string;
  value: string;
}

function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="flex flex-col items-center gap-1 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
      <span className="text-xl">{icon}</span>
      <span className="text-white font-semibold text-sm">{value}</span>
      <span className="text-white/50 text-xs">{label}</span>
    </div>
  );
}

export default function WeatherStats({ consensus, unit }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Stat icon="🌡️" label="Feels Like" value={formatTemp(consensus.feelsLike, unit)} />
      <Stat icon="💧" label="Humidity" value={`${consensus.humidity}%`} />
      <Stat icon="💨" label="Wind" value={`${consensus.windSpeed} km/h`} />
      <Stat icon="🌂" label="Precip." value={`${consensus.precipitationProbability}%`} />
    </div>
  );
}
