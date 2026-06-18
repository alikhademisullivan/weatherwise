import { useState } from 'react';
import type { ConsensusReading } from '../types/weather';
import { formatWind } from '../utils/formatters';

interface Props {
  consensus: ConsensusReading;
  city: string;
  unit: 'C' | 'F';
  coords?: { lat: number; lon: number };
}

function convertTemp(c: number, unit: 'C' | 'F'): string {
  const val = unit === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c);
  return `${val}°${unit}`;
}

function buildShareUrl(city: string, coords?: { lat: number; lon: number }): string {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  if (coords) {
    params.set('lat', coords.lat.toFixed(4));
    params.set('lon', coords.lon.toFixed(4));
  } else if (city) {
    params.set('city', city);
  }
  return `${base}?${params.toString()}`;
}

function buildShareText(consensus: ConsensusReading, city: string, unit: 'C' | 'F', coords?: { lat: number; lon: number }): string {
  const temp = convertTemp(consensus.temperature, unit);
  const sources = consensus.sources.length;
  const confidence = consensus.confidenceScore;
  const condition = consensus.condition.replace(/_/g, ' ');
  const spreadDisplay = unit === 'F' ? (consensus.spread * 9 / 5).toFixed(1) : consensus.spread.toFixed(1);
  const url = buildShareUrl(city, coords);

  const lines = [
    `📍 ${city} · ${temp} · ${condition}`,
    consensus.isDisputed
      ? `⚠️ Sources split ${spreadDisplay}°${unit} apart — low confidence (${confidence}/100)`
      : `✅ ${sources} sources agree · ${confidence}/100 confidence`,
    `💧 ${consensus.precipitationProbability}% rain  💨 ${formatWind(consensus.windSpeed, unit)}`,
    `\n${url}`,
    `via WeatherWise — the forecast that tells you when to trust the forecast`,
  ];

  return lines.join('\n');
}

export default function ShareCard({ consensus, city, unit, coords }: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = buildShareText(consensus, city, unit, coords);
    const url = buildShareUrl(city, coords);

    if (navigator.share) {
      try {
        await navigator.share({ title: `WeatherWise · ${city}`, text, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard unavailable — silent fail
    }
  }

  return (
    <button
      onClick={share}
      title="Share current conditions"
      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
    >
      {copied ? (
        <>
          <span>✓</span>
          <span>Copied</span>
        </>
      ) : (
        <>
          <span>↗</span>
          <span>Share</span>
        </>
      )}
    </button>
  );
}
