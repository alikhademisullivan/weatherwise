import { describe, it, expect } from 'vitest';
import { buildConsensus, mergeForecastDays } from '../services/consensus';
import type { SourceReading, ForecastDay } from '../types/weather';

const makeReading = (source: string, temp: number, overrides: Partial<SourceReading> = {}): SourceReading => ({
  source,
  temperature: temp,
  feelsLike: temp - 1,
  humidity: 60,
  windSpeed: 15,
  precipitationProbability: 20,
  condition: 'Partly Cloudy',
  conditionCode: 'partly_cloudy',
  fetchedAt: new Date().toISOString(),
  ...overrides,
});

describe('buildConsensus', () => {
  it('computes weighted average temperature', () => {
    const readings = [makeReading('Open-Meteo', 18), makeReading('OpenWeatherMap', 20)];
    const result = buildConsensus(readings, 'Toronto');
    expect(result.temperature).toBe(19);
  });

  it('marks as disputed when spread > 3°C', () => {
    const readings = [makeReading('Open-Meteo', 15), makeReading('OpenWeatherMap', 20)];
    const result = buildConsensus(readings, 'Toronto');
    expect(result.spread).toBe(5);
    expect(result.isDisputed).toBe(true);
  });

  it('marks as not disputed when spread ≤ 3°C', () => {
    const readings = [makeReading('Open-Meteo', 18), makeReading('OpenWeatherMap', 19)];
    const result = buildConsensus(readings, 'Toronto');
    expect(result.isDisputed).toBe(false);
  });

  it('confidence score is 100 when all sources agree exactly', () => {
    const readings = [makeReading('Open-Meteo', 20), makeReading('OpenWeatherMap', 20)];
    const result = buildConsensus(readings, 'Toronto');
    expect(result.spread).toBe(0);
    expect(result.confidenceScore).toBe(100);
  });

  it('throws when no readings supplied', () => {
    expect(() => buildConsensus([], 'Toronto')).toThrow();
  });

  it('works with a single source', () => {
    const readings = [makeReading('Open-Meteo', 22)];
    const result = buildConsensus(readings, 'Toronto');
    expect(result.temperature).toBe(22);
    expect(result.isDisputed).toBe(false);
  });
});

describe('mergeForecastDays', () => {
  const makeDay = (date: string, high: number, low: number): ForecastDay => ({
    date,
    high,
    low,
    spreadHigh: high,
    spreadLow: low,
    precipitationProbability: 20,
    condition: 'Partly Cloudy',
    isDisputed: false,
  });

  it('merges two sources and computes spread', () => {
    const source1 = [makeDay('2025-01-01', 20, 10)];
    const source2 = [makeDay('2025-01-01', 24, 8)];
    const [merged] = mergeForecastDays([source1, source2]);
    expect(merged.high).toBe(22);
    expect(merged.spreadHigh).toBe(24);
    expect(merged.spreadLow).toBe(8);
  });
});
