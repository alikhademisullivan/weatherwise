import type { SourceReading, ConsensusReading, ForecastDay } from '../types/weather';

const DISPUTE_THRESHOLD = parseFloat(process.env.DISPUTE_THRESHOLD_CELSIUS ?? '3');

const DEFAULT_WEIGHTS: Record<string, number> = {
  'Open-Meteo': 1.0,
  'OpenWeatherMap': 1.0,
  'Tomorrow.io': 1.0,
  'WeatherAPI': 1.0,
};

function weight(source: string, dynamicWeights: Record<string, number>): number {
  return dynamicWeights[source] ?? DEFAULT_WEIGHTS[source] ?? 1.0;
}

function weightedAvg(readings: SourceReading[], field: keyof Pick<SourceReading, 'temperature' | 'feelsLike' | 'humidity' | 'windSpeed' | 'precipitationProbability'>, dynamicWeights: Record<string, number>): number {
  const totalW = readings.reduce((s, r) => s + weight(r.source, dynamicWeights), 0);
  return readings.reduce((s, r) => s + (r[field] as number) * weight(r.source, dynamicWeights), 0) / totalW;
}

function weightedAvgOptional(readings: SourceReading[], field: keyof SourceReading, dynamicWeights: Record<string, number>): number | undefined {
  const valid = readings.filter(r => r[field] != null);
  if (!valid.length) return undefined;
  const totalW = valid.reduce((s, r) => s + weight(r.source, dynamicWeights), 0);
  return valid.reduce((s, r) => s + (r[field] as number) * weight(r.source, dynamicWeights), 0) / totalW;
}

function firstDefined<T>(readings: SourceReading[], field: keyof SourceReading): T | undefined {
  for (const r of readings) {
    if (r[field] != null) return r[field] as T;
  }
  return undefined;
}

function majorityCondition(readings: SourceReading[], dynamicWeights: Record<string, number>): string {
  const counts: Record<string, number> = {};
  for (const r of readings) counts[r.condition] = (counts[r.condition] ?? 0) + weight(r.source, dynamicWeights);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function disputeMessage(spread: number, precipSpread: number): string {
  if (spread > 5) return "Sources strongly disagree — treat this forecast with caution.";
  if (spread > DISPUTE_THRESHOLD) return "Sources are split on temperature — pack layers just in case.";
  if (precipSpread > 30) return "Sources can't agree on rain chances — bring an umbrella.";
  return "Sources are in good agreement on today's forecast.";
}

function fieldSpread(readings: SourceReading[], field: keyof SourceReading): number | undefined {
  const vals = readings.map(r => r[field]).filter((v): v is number => typeof v === 'number');
  if (vals.length < 2) return undefined;
  return parseFloat((Math.max(...vals) - Math.min(...vals)).toFixed(1));
}

export function buildConsensus(readings: SourceReading[], location: string, dynamicWeights: Record<string, number> = {}): ConsensusReading {
  if (!readings.length) throw new Error('No source readings to aggregate');

  const temps = readings.map(r => r.temperature);
  const precips = readings.map(r => r.precipitationProbability);
  const spread = Math.max(...temps) - Math.min(...temps);
  const precipSpread = Math.max(...precips) - Math.min(...precips);
  const confidenceScore = Math.max(0, Math.round(100 - (spread / 10) * 100));

  // Extended averages
  const uvIndex = weightedAvgOptional(readings, 'uvIndex', dynamicWeights);
  const pressure = weightedAvgOptional(readings, 'pressure', dynamicWeights);
  const dewPoint = weightedAvgOptional(readings, 'dewPoint', dynamicWeights);
  const visibility = weightedAvgOptional(readings, 'visibility', dynamicWeights);
  const windDirection = weightedAvgOptional(readings, 'windDirection', dynamicWeights);
  const windGust = weightedAvgOptional(readings, 'windGust', dynamicWeights);
  const cloudCover = weightedAvgOptional(readings, 'cloudCover', dynamicWeights);
  const precipitationMm = weightedAvgOptional(readings, 'precipitationMm', dynamicWeights);

  // Spreads for secondary fields
  const fieldSpreads = {
    uvIndex: fieldSpread(readings, 'uvIndex'),
    humidity: fieldSpread(readings, 'humidity'),
    windSpeed: fieldSpread(readings, 'windSpeed'),
    pressure: fieldSpread(readings, 'pressure'),
    precipitationProbability: parseFloat(precipSpread.toFixed(1)),
  };

  return {
    temperature: parseFloat(weightedAvg(readings, 'temperature', dynamicWeights).toFixed(1)),
    feelsLike: parseFloat(weightedAvg(readings, 'feelsLike', dynamicWeights).toFixed(1)),
    humidity: Math.round(weightedAvg(readings, 'humidity', dynamicWeights)),
    windSpeed: parseFloat(weightedAvg(readings, 'windSpeed', dynamicWeights).toFixed(1)),
    precipitationProbability: Math.round(weightedAvg(readings, 'precipitationProbability', dynamicWeights)),
    condition: majorityCondition(readings, dynamicWeights),
    sources: readings,
    spread: parseFloat(spread.toFixed(1)),
    confidenceScore,
    isDisputed: spread > DISPUTE_THRESHOLD,
    disputeMessage: disputeMessage(spread, precipSpread),
    location,
    updatedAt: new Date().toISOString(),
    uvIndex: uvIndex != null ? parseFloat(uvIndex.toFixed(1)) : undefined,
    pressure: pressure != null ? parseFloat(pressure.toFixed(0)) : undefined,
    dewPoint: dewPoint != null ? parseFloat(dewPoint.toFixed(1)) : undefined,
    visibility: visibility != null ? parseFloat(visibility.toFixed(1)) : undefined,
    windDirection: windDirection != null ? Math.round(windDirection) : undefined,
    windGust: windGust != null ? parseFloat(windGust.toFixed(1)) : undefined,
    cloudCover: cloudCover != null ? Math.round(cloudCover) : undefined,
    precipitationMm: precipitationMm != null ? parseFloat(precipitationMm.toFixed(1)) : undefined,
    sunriseTime: firstDefined<string>(readings, 'sunriseTime'),
    sunsetTime: firstDefined<string>(readings, 'sunsetTime'),
    moonPhase: firstDefined<string>(readings, 'moonPhase'),
    airQualityIndex: firstDefined<number>(readings, 'airQualityIndex'),
    airQualityCategory: firstDefined<string>(readings, 'airQualityCategory'),
    fieldSpreads,
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

  const sortedDates = Object.keys(byDate).sort();

  return sortedDates.map((date, dayIndex) => {
      const days = byDate[date];
      const highs = days.map(d => d.high);
      const lows = days.map(d => d.low);
      const spread = Math.max(...highs) - Math.min(...lows);
      const avgHigh = highs.reduce((s, v) => s + v, 0) / highs.length;
      const avgLow = lows.reduce((s, v) => s + v, 0) / lows.length;
      const avgPrecip = days.reduce((s, d) => s + d.precipitationProbability, 0) / days.length;

      const condCounts: Record<string, number> = {};
      for (const d of days) condCounts[d.condition] = (condCounts[d.condition] ?? 0) + 1;
      const condition = Object.entries(condCounts).sort((a, b) => b[1] - a[1])[0][0];

      // Aggregate extended fields
      const uvVals = days.map(d => d.uvIndexMax).filter((v): v is number => v != null);
      const precipMmVals = days.map(d => d.precipMm).filter((v): v is number => v != null);
      const gustVals = days.map(d => d.windGustMax).filter((v): v is number => v != null);
      const snowVals = days.map(d => d.snowfallMm).filter((v): v is number => v != null);

      // Sunrise/sunset from first source that has them
      const sunriseTime = days.find(d => d.sunriseTime)?.sunriseTime;
      const sunsetTime = days.find(d => d.sunsetTime)?.sunsetTime;
      const conditionCode = days.find(d => d.conditionCode)?.conditionCode;

      // Honest confidence tier based on forecast horizon
      const confidenceTier: 'high' | 'medium' | 'low' =
        dayIndex < 3 ? 'high' : dayIndex < 6 ? 'medium' : 'low';

      const tempRangeLow = dayIndex >= 3 ? parseFloat(Math.min(...lows).toFixed(0)) : undefined;
      const tempRangeHigh = dayIndex >= 3 ? parseFloat(Math.max(...highs).toFixed(0)) : undefined;

      // Trend text for low-confidence days (day 7+)
      let trend: string | undefined;
      if (dayIndex >= 6) {
        const highRain = avgPrecip >= 50;
        const someRain = avgPrecip >= 25;
        const isWarm = avgHigh >= 25;
        const isCold = avgHigh <= 10;
        const parts: string[] = [];
        if (isWarm) parts.push('Warmer than average');
        else if (isCold) parts.push('Cooler than average');
        else parts.push('Near-average temps');
        if (highRain) parts.push('rain likely');
        else if (someRain) parts.push('some rain possible');
        trend = parts.join(', ');
      }

      return {
        date,
        high: parseFloat(avgHigh.toFixed(1)),
        low: parseFloat(avgLow.toFixed(1)),
        spreadHigh: Math.max(...highs),
        spreadLow: Math.min(...lows),
        precipitationProbability: Math.round(avgPrecip),
        condition,
        conditionCode,
        isDisputed: spread > DISPUTE_THRESHOLD,
        uvIndexMax: uvVals.length ? parseFloat((uvVals.reduce((a, b) => a + b, 0) / uvVals.length).toFixed(1)) : undefined,
        precipMm: precipMmVals.length ? parseFloat(precipMmVals.reduce((a, b) => a + b, 0).toFixed(1)) : undefined,
        windGustMax: gustVals.length ? parseFloat(Math.max(...gustVals).toFixed(1)) : undefined,
        snowfallMm: snowVals.length ? parseFloat(snowVals.reduce((a, b) => a + b, 0).toFixed(1)) : undefined,
        sunriseTime,
        sunsetTime,
        confidenceTier,
        tempRangeLow,
        tempRangeHigh,
        trend,
      } satisfies ForecastDay;
    });
}
