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
}

export interface WeatherResponse {
  location: string;
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
  windSpeed: number;
  condition: string;
  conditionCode: string;
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
