export interface SourceReading {
  source: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  precipitationProbability: number;
  condition: string;
  conditionCode: string;
  fetchedAt: string;
  // Extended fields (Phase 4)
  uvIndex?: number;
  pressure?: number;
  dewPoint?: number;
  visibility?: number;
  windDirection?: number;
  windGust?: number;
  cloudCover?: number;
  precipitationMm?: number;
  sunriseTime?: string;
  sunsetTime?: string;
  moonPhase?: string;
  airQualityIndex?: number;
  airQualityCategory?: string;
}

export interface ConsensusReading {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  precipitationProbability: number;
  condition: string;
  sources: SourceReading[];
  spread: number;
  confidenceScore: number;
  isDisputed: boolean;
  disputeMessage: string;
  location: string;
  updatedAt: string;
  // Extended fields (Phase 4)
  uvIndex?: number;
  pressure?: number;
  dewPoint?: number;
  visibility?: number;
  windDirection?: number;
  windGust?: number;
  cloudCover?: number;
  precipitationMm?: number;
  sunriseTime?: string;
  sunsetTime?: string;
  moonPhase?: string;
  airQualityIndex?: number;
  airQualityCategory?: string;
  fieldSpreads?: {
    uvIndex?: number;
    humidity?: number;
    windSpeed?: number;
    pressure?: number;
    precipitationProbability?: number;
  };
}

export interface ForecastDay {
  date: string;
  high: number;
  low: number;
  spreadHigh: number;
  spreadLow: number;
  precipitationProbability: number;
  condition: string;
  isDisputed: boolean;
  // Extended fields (Phase 4)
  uvIndexMax?: number;
  precipMm?: number;
  windGustMax?: number;
  sunriseTime?: string;
  sunsetTime?: string;
  snowfallMm?: number;
  conditionCode?: string;
  // Honest forecast confidence (Feature 4)
  confidenceTier?: 'high' | 'medium' | 'low';
  tempRangeLow?: number;
  tempRangeHigh?: number;
  trend?: string;
}

export type FeedbackType = 'accurate' | 'too_warm' | 'too_cold' | 'missed_rain' | 'false_rain';

export interface FeedbackSummary {
  total: number;
  accurate: number;
  too_warm: number;
  too_cold: number;
  missed_rain: number;
  false_rain: number;
  insight: string | null;
}

export interface WeatherResponse {
  location: string;
  resolvedCity?: string;
  consensus: ConsensusReading;
  sources: SourceReading[];
  updatedAt: string;
  cached?: boolean;
}

export interface ForecastResponse {
  location: string;
  forecast: ForecastDay[];
  updatedAt: string;
  cached?: boolean;
}

export interface HourlyReading {
  time: string;
  temperature: number;
  precipitationProbability: number;
  precipitationMm: number;
  windSpeed: number;
  condition: string;
  conditionCode: string;
  pressure?: number;
}

export interface HourlyForecastResponse {
  location: string;
  hours: HourlyReading[];
  updatedAt: string;
  cached?: boolean;
}

export interface SourceAccuracy {
  source: string;
  mae: number;
  accuracyScore: number;
  sampleCount: number;
  weight: number;
}

export interface AccuracyResponse {
  location: string;
  sources: SourceAccuracy[];
  usingDynamicWeights: boolean;
  updatedAt: string;
}

export interface WeatherAlert {
  headline: string;
  event: string;
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Extreme';
  urgency: string;
  effective: string;
  expires: string;
  description: string;
}

export interface AlertsResponse {
  location: string;
  alerts: WeatherAlert[];
  updatedAt: string;
}

export interface HistoricalDay {
  high: number;
  low: number;
  condition: string;
}

export interface HistoricalResponse {
  city: string;
  yesterdayDate: string;
  lastYearDate: string;
  yesterday: HistoricalDay | null;
  lastYear: HistoricalDay | null;
  updatedAt: string;
  cached?: boolean;
}

export interface PrecipMinute {
  time: string;
  precipProbability: number;
  precipIntensity: number;
}

export interface PrecipTimelineResponse {
  city: string;
  minutes: PrecipMinute[];
  source: string;
  updatedAt: string;
  cached?: boolean;
  fallback?: boolean;
  message?: string;
}
