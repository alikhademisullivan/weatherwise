import type { ConsensusReading, ForecastDay } from '../types/weather';
import { degreesToCompass } from '../utils/formatters';

interface Props {
  consensus: ConsensusReading;
  forecast?: ForecastDay[];
}

function generateSummary(consensus: ConsensusReading, forecast?: ForecastDay[]): string {
  const parts: string[] = [];

  // Confidence lead
  if (consensus.confidenceScore >= 80) {
    parts.push('Sources strongly agree on today\'s forecast.');
  } else if (consensus.isDisputed) {
    parts.push(`Sources are split — temperatures vary by up to ${consensus.spread}°C across providers.`);
  } else {
    parts.push('Sources are in reasonable agreement today.');
  }

  // Temperature + condition tone
  const temp = consensus.temperature;
  let tempTone = '';
  if (temp >= 30) tempTone = 'Hot conditions';
  else if (temp >= 24) tempTone = 'Warm afternoon';
  else if (temp >= 18) tempTone = 'Comfortable temperatures';
  else if (temp >= 10) tempTone = 'Cool conditions';
  else if (temp >= 0) tempTone = 'Cold day';
  else tempTone = 'Freezing temperatures';

  const condition = consensus.condition.toLowerCase();
  let condNote = '';
  if (condition.includes('thunder')) condNote = 'with thunderstorms likely';
  else if (condition.includes('snow')) condNote = 'with snowfall expected';
  else if (condition.includes('rain') || condition.includes('drizzle')) {
    const prob = consensus.precipitationProbability;
    condNote = prob >= 70 ? 'and rain is likely' : `with a ${prob}% chance of rain`;
  } else if (condition.includes('fog')) condNote = 'and foggy conditions';
  else if (condition.includes('clear') || condition.includes('sunny')) condNote = 'and clear skies';
  else if (condition.includes('cloud')) condNote = 'and cloudy skies';

  parts.push(`${tempTone}${condNote ? ' ' + condNote : ''}.`);

  // UV/wind/tomorrow
  const advisories: string[] = [];

  if (consensus.uvIndex != null && consensus.uvIndex >= 6) {
    advisories.push(`High UV (${consensus.uvIndex.toFixed(0)}) — wear SPF 30+`);
  }
  if (consensus.windSpeed > 40) {
    const dir = consensus.windDirection != null ? ` from the ${degreesToCompass(consensus.windDirection)}` : '';
    advisories.push(`Strong winds at ${consensus.windSpeed} km/h${dir}`);
  } else if (consensus.windSpeed > 20) {
    const dir = consensus.windDirection != null ? ` from the ${degreesToCompass(consensus.windDirection)}` : '';
    advisories.push(`Breezy at ${consensus.windSpeed} km/h${dir}`);
  }

  if (forecast && forecast.length > 1) {
    const tomorrow = forecast[1];
    const tempDiff = tomorrow.high - consensus.temperature;
    const tmwCond = tomorrow.condition.toLowerCase();
    let tmwNote = '';
    if (tempDiff > 4) tmwNote = 'warmer';
    else if (tempDiff < -4) tmwNote = 'cooler';
    if (tomorrow.precipitationProbability >= 60) {
      tmwNote = tmwNote ? `${tmwNote}, rain likely` : 'rain likely';
    } else if (tmwCond.includes('snow')) {
      tmwNote = tmwNote ? `${tmwNote}, snow possible` : 'snow possible';
    }
    if (tmwNote) advisories.push(`Tomorrow: ${tmwNote}`);
  }

  if (advisories.length) {
    parts.push(advisories.join(' · ') + '.');
  }

  return parts.join(' ');
}

export default function SmartSummary({ consensus, forecast }: Props) {
  const summary = generateSummary(consensus, forecast);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-3">
      <p className="text-white/60 text-sm leading-relaxed">{summary}</p>
    </div>
  );
}
