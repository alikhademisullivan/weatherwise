import { useState } from 'react';
import type { ConsensusReading } from '../types/weather';

interface Props {
  consensus: ConsensusReading;
  city: string;
  unit: 'C' | 'F';
}

function convertTemp(c: number, unit: 'C' | 'F'): string {
  const val = unit === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c);
  return `${val}°${unit}`;
}

function buildShareText(consensus: ConsensusReading, city: string, unit: 'C' | 'F'): string {
  const temp = convertTemp(consensus.temperature, unit);
  const sources = consensus.sources.length;
  const confidence = consensus.confidenceScore;
  const condition = consensus.condition.replace(/_/g, ' ');

  const lines = [
    `📍 ${city} · ${temp} · ${condition}`,
    consensus.isDisputed
      ? `⚠️ Sources split ${consensus.spread.toFixed(1)}° apart — low confidence (${confidence}/100)`
      : `✅ ${sources} sources agree · ${confidence}/100 confidence`,
    `💧 ${consensus.precipitationProbability}% rain  💨 ${Math.round(consensus.windSpeed)} km/h`,
    `\nvia WeatherWise — the forecast that tells you when to trust the forecast`,
  ];

  return lines.join('\n');
}

export default function ShareCard({ consensus, city, unit }: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = buildShareText(consensus, city, unit);

    if (navigator.share) {
      try {
        await navigator.share({ title: `WeatherWise · ${city}`, text });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Clipboard fallback
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
