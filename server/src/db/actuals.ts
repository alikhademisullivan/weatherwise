import { query, queryOne } from './pool';

export interface ActualRow {
  id: number;
  location: string;
  actual_date: string;
  temp_high: number;
  temp_low: number;
  condition: string;
}

export async function upsertActual(
  location: string,
  date: string,
  tempHigh: number,
  tempLow: number,
  condition: string,
): Promise<void> {
  await query(
    `INSERT INTO actuals (location, actual_date, temp_high, temp_low, condition)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (location, actual_date) DO UPDATE
       SET temp_high = EXCLUDED.temp_high,
           temp_low  = EXCLUDED.temp_low,
           condition = EXCLUDED.condition`,
    [location.toLowerCase(), date, tempHigh, tempLow, condition],
  );
}

export async function getActual(location: string, date: string): Promise<ActualRow | null> {
  return queryOne<ActualRow>(
    `SELECT * FROM actuals WHERE location = $1 AND actual_date = $2`,
    [location.toLowerCase(), date],
  );
}
