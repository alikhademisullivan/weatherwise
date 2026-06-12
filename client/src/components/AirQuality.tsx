interface Props {
  aqi: number;
  category: string;
}

interface AqiLevel {
  label: string;
  color: string;
  bg: string;
  guidance: string;
  maxEpa: number;
}

const AQI_LEVELS: AqiLevel[] = [
  { maxEpa: 1, label: 'Good',                              color: 'bg-emerald-400', bg: 'bg-emerald-500/10', guidance: 'Air quality is satisfactory — enjoy outdoor activities.' },
  { maxEpa: 2, label: 'Moderate',                          color: 'bg-yellow-400',  bg: 'bg-yellow-500/10',  guidance: 'Air quality is acceptable. Unusually sensitive individuals may consider limiting prolonged outdoor exertion.' },
  { maxEpa: 3, label: 'Unhealthy for Sensitive Groups',    color: 'bg-orange-400',  bg: 'bg-orange-500/10',  guidance: 'Sensitive individuals should limit prolonged outdoor exertion.' },
  { maxEpa: 4, label: 'Unhealthy',                         color: 'bg-red-400',     bg: 'bg-red-500/10',     guidance: 'Everyone may begin to experience health effects. Limit prolonged outdoor exertion.' },
  { maxEpa: 5, label: 'Very Unhealthy',                    color: 'bg-purple-400',  bg: 'bg-purple-500/10',  guidance: 'Health alert — everyone may experience more serious health effects.' },
  { maxEpa: 6, label: 'Hazardous',                         color: 'bg-rose-900',    bg: 'bg-rose-900/20',    guidance: 'Health emergency — avoid all outdoor activities.' },
];

function getLevel(epaIdx: number): AqiLevel {
  return AQI_LEVELS.find(l => epaIdx <= l.maxEpa) ?? AQI_LEVELS[AQI_LEVELS.length - 1];
}

export default function AirQuality({ aqi, category }: Props) {
  const level = getLevel(aqi);
  return (
    <div className={`rounded-2xl border border-white/15 backdrop-blur-sm p-6 ${level.bg}`}>
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Air Quality</h2>

      <div className="flex items-center gap-3 mb-3">
        <div className="text-2xl font-bold text-white">{category}</div>
      </div>

      {/* Color scale bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-2">
        {AQI_LEVELS.map((l, i) => (
          <div
            key={i}
            className={`flex-1 ${l.color} ${aqi > i + 1 ? 'opacity-100' : aqi === i + 1 ? 'opacity-100 ring-2 ring-white/50' : 'opacity-20'}`}
          />
        ))}
      </div>

      <p className="text-white/50 text-xs leading-relaxed">{level.guidance}</p>
    </div>
  );
}
