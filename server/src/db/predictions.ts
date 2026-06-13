import { query } from './pool';

export interface PredictionRow {
  id: number;
  source: string;
  location: string;
  latitude: number;
  longitude: number;
  for_date: string;
  temp_high: number;
  temp_low: number;
  condition: string;
  created_at: string;
}

export interface LocationMeta {
  location: string;
  latitude: number;
  longitude: number;
}

export async function recordPrediction(
  source: string,
  location: string,
  latitude: number,
  longitude: number,
  forDate: string,
  tempHigh: number,
  tempLow: number,
  condition: string,
): Promise<void> {
  await query(
    `INSERT INTO predictions (source, location, latitude, longitude, for_date, temp_high, temp_low, condition)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [source, location.toLowerCase(), latitude, longitude, forDate, tempHigh, tempLow, condition],
  );
}

export async function getPredictionsForDate(location: string, date: string): Promise<PredictionRow[]> {
  return query<PredictionRow>(
    `SELECT * FROM predictions WHERE location = $1 AND for_date = $2`,
    [location.toLowerCase(), date],
  );
}

export async function getUniqueLocations(): Promise<LocationMeta[]> {
  return query<LocationMeta>(
    `SELECT DISTINCT ON (location) location, latitude, longitude
     FROM predictions
     ORDER BY location, created_at DESC`,
  );
}
