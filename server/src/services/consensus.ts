import type { SourceReading, ConsensusReading, ForecastDay } from '../types/weather';

const DISPUTE_THRESHOLD = parseFloat(process.env.DISPUTE_THRESHOLD_CELSIUS ?? '3');

const SOURCE_WEIGHTS: Record<string, number> = {
  'Open-Meteo': 1.0,
  'OpenWeatherMap': 1.0,
  'Tomorrow.io': 1.0,
  'WeatherAPI': 1.0,
};

function weight(source: string): number {
  return SOURCE_WEIGHTS[source] ?? 1.0;
}

function weightedAvg(readings: SourceReading[], field: keyof Pick<SourceReading, 'temperature' | 'feelsLike' | 'humidity' | 'windSpeed' | 'precipitationProbability'>): number {
  const totalW = readings.reduce((s, r) => s + weight(r.source), 0);
  return readings.reduce((s, r) => s + (r[field] as number) * weight(r.source), 0) / totalW;
}

function majorityCondition(readings: SourceReading[]): string {
  const counts: Record<string, number> = {};
  for (const r of readings) counts[r.condition] = (counts[r.condition] ?? 0) + weight(r.source);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function disputeMessage(spread: number, precipSpread: number): string {
  if (spread > 5) return "Sources strongly disagree — treat this forecast with caution.";
  if (spread > DISPUTE_THRESHOLD) return "Sources are split on temperature — pack layers just in case.";
  if (precipSpread > 30) return "Sources can't agree on rain chances — bring an umbrella.";
  return "Sources are in good agreement on today's forecast.";
}

export function buildConsensus(readings: SourceReading[], location: string): ConsensusReading {
  if (!readings.length) throw new Error('No source readings to aggregate');

  const temps = readings.map(r => r.temperature);
  const precips = readings.map(r => r.precipitationProbability);
  const spread = Math.max(...temps) - Math.min(...temps);
  const precipSpread = Math.max(...precips) - Math.min(...precips);
  const confidenceScore = Math.max(0, Math.round(100 - (spread / 10) * 100));

  return {
    temperature: parseFloat(weightedAvg(readings, 'temperature').toFixed(1)),
    feelsLike: parseFloat(weightedAvg(readings, 'feelsLike').toFixed(1)),
    humidity: Math.round(weightedAvg(readings, 'humidity')),
    windSpeed: parseFloat(weightedAvg(readings, 'windSpeed').toFixed(1)),
    precipitationProbability: Math.round(weightedAvg(readings, 'precipitationProbability')),
    condition: majorityCondition(readings),
    sources: readings,
    spread: parseFloat(spread.toFixed(1)),
    confidenceScore,
    isDisputed: spread > DISPUTE_THRESHOLD,
    disputeMessage: disputeMessage(spread, precipSpread),
    location,
    updatedAt: new Date().toISOString(),
  };
}

export function mergeForecastDays(perSourceForecasts: ForecastDay[][]): ForecastDay[] {
  const byDate: Record<string, ForecastDay[]> = {};

  for (const days of perSourceForecasts) {
    for (const day of days) {
      if (!byDate[day.date]) byDate[day.date] = [];
      byDate[day.date].push(day);
    }
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, days]) => {
      const highs = days.map(d => d.high);
      const lows = days.map(d => d.low);
      const spread = Math.max(...highs) - Math.min(...lows);
      const avgHigh = highs.reduce((s, v) => s + v, 0) / highs.length;
      const avgLow = lows.reduce((s, v) => s + v, 0) / lows.length;
      const avgPrecip = days.reduce((s, d) => s + d.precipitationProbability, 0) / days.length;

      // majority condition
      const condCounts: Record<string, number> = {};
      for (const d of days) condCounts[d.condition] = (condCounts[d.condition] ?? 0) + 1;
      const condition = Object.entries(condCounts).sort((a, b) => b[1] - a[1])[0][0];

      return {
        date,
        high: parseFloat(avgHigh.toFixed(1)),
        low: parseFloat(avgLow.toFixed(1)),
        spreadHigh: Math.max(...highs),
        spreadLow: Math.min(...lows),
        precipitationProbability: Math.round(avgPrecip),
        condition,
        isDisputed: spread > DISPUTE_THRESHOLD,
      } satisfies ForecastDay;
    });
}
