import type { ConsensusReading } from '../types/weather';
import { formatTemp, degreesToCompass, uvRisk, dayLength } from '../utils/formatters';

interface Props {
  consensus: ConsensusReading;
  unit: 'C' | 'F';
}

interface TileProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}

function Tile({ icon, label, value, sub, warn }: TileProps) {
  return (
    <div className="flex flex-col gap-1 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
        {warn && <span className="text-amber-400 text-xs" title="Sources disagree on this value">⚠</span>}
      </div>
      <span className="text-white font-semibold text-sm">{value}</span>
      <span className="text-white/50 text-xs">{label}</span>
      {sub && <span className="text-white/35 text-xs">{sub}</span>}
    </div>
  );
}

function pressureLabel(hpa: number): string {
  if (hpa > 1020) return 'High pressure · fair weather';
  if (hpa < 1000) return 'Low pressure · unsettled';
  return 'Variable';
}

function cloudLabel(pct: number): string {
  if (pct < 20) return 'Clear skies';
  if (pct < 50) return 'Partly cloudy';
  if (pct < 85) return 'Mostly cloudy';
  return 'Overcast';
}

function visibilityLabel(km: number): string {
  if (km >= 10) return 'Clear';
  if (km >= 5) return 'Good';
  if (km >= 2) return 'Moderate';
  return 'Reduced';
}

export default function DetailsPanel({ consensus, unit }: Props) {
  const fs = consensus.fieldSpreads;

  const tiles: TileProps[] = [
    {
      icon: '🌡️',
      label: 'Feels Like',
      value: formatTemp(consensus.feelsLike, unit),
      sub: 'Wind & humidity effect',
    },
  ];

  if (consensus.uvIndex != null) {
    const uv = uvRisk(consensus.uvIndex);
    tiles.push({
      icon: '☀️',
      label: 'UV Index',
      value: `${consensus.uvIndex.toFixed(0)} · ${uv.label}`,
      sub: 'Wear SPF 30+ above 6',
      warn: fs?.uvIndex != null && fs.uvIndex > 2,
    });
  }

  tiles.push({
    icon: '💧',
    label: 'Humidity',
    value: `${consensus.humidity}%`,
    sub: consensus.dewPoint != null ? `Dew point ${formatTemp(consensus.dewPoint, unit)}` : undefined,
    warn: fs?.humidity != null && fs.humidity > 20,
  });

  if (consensus.pressure != null) {
    tiles.push({
      icon: '🔽',
      label: 'Pressure',
      value: `${consensus.pressure} hPa`,
      sub: pressureLabel(consensus.pressure),
      warn: fs?.pressure != null && fs.pressure > 10,
    });
  }

  const windValue = consensus.windDirection != null
    ? `${consensus.windSpeed} km/h ${degreesToCompass(consensus.windDirection)}`
    : `${consensus.windSpeed} km/h`;

  tiles.push({
    icon: '💨',
    label: 'Wind',
    value: windValue,
    sub: consensus.windGust != null ? `Gusts ${consensus.windGust} km/h` : undefined,
    warn: fs?.windSpeed != null && fs.windSpeed > 15,
  });

  if (consensus.visibility != null) {
    tiles.push({
      icon: '👁️',
      label: 'Visibility',
      value: `${consensus.visibility} km`,
      sub: visibilityLabel(consensus.visibility),
    });
  }

  if (consensus.cloudCover != null) {
    tiles.push({
      icon: '☁️',
      label: 'Cloud Cover',
      value: `${consensus.cloudCover}%`,
      sub: cloudLabel(consensus.cloudCover),
    });
  }

  tiles.push({
    icon: '🌧️',
    label: 'Precipitation',
    value: `${consensus.precipitationProbability}%`,
    sub: consensus.precipitationMm != null ? `${consensus.precipitationMm} mm today` : undefined,
    warn: fs?.precipitationProbability != null && fs.precipitationProbability > 30,
  });

  if (consensus.sunriseTime && consensus.sunsetTime) {
    const dl = dayLength(consensus.sunriseTime, consensus.sunsetTime);
    tiles.push({
      icon: '🌅',
      label: 'Sunrise / Sunset',
      value: `${consensus.sunriseTime} · ${consensus.sunsetTime}`,
      sub: dl || undefined,
    });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tiles.map(t => (
        <Tile key={t.label} {...t} />
      ))}
    </div>
  );
}
