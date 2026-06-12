import { query, queryOne } from './pool';
import { getPredictionsForDate } from './predictions';
import { getActual } from './actuals';

export interface AccuracyRow {
  source: string;
  location: string;
  mae: number;
  accuracy_score: number;
  sample_count: number;
  updated_at: string;
}

export async function getAccuracyScores(location: string): Promise<AccuracyRow[]> {
  return query<AccuracyRow>(
    `SELECT * FROM source_accuracy WHERE location = $1 ORDER BY accuracy_score DESC`,
    [location.toLowerCase()],
  );
}

export async function getDynamicWeights(location: string): Promise<Record<string, number>> {
  const rows = await getAccuracyScores(location);
  if (!rows.length) return {};

  const weights: Record<string, number> = {};
  for (const r of rows) {
    // Floor at 0.1 so a struggling source still contributes a little
    weights[r.source] = Math.max(0.1, r.accuracy_score / 100);
  }
  return weights;
}

export async function computeAndSaveAccuracy(location: string): Promise<void> {
  // Look at the last 30 days of predictions that have matching actuals
  const rows = await query<{ source: string; for_date: string; pred_high: number; pred_low: number; act_high: number; act_low: number }>(
    `SELECT p.source,
            p.for_date::text,
            p.temp_high            AS pred_high,
            p.temp_low             AS pred_low,
            a.temp_high            AS act_high,
            a.temp_low             AS act_low
     FROM predictions p
     JOIN actuals a
       ON a.location = p.location AND a.actual_date = p.for_date
     WHERE p.location = $1
       AND p.for_date >= CURRENT_DATE - INTERVAL '30 days'
     ORDER BY p.source, p.for_date`,
    [location.toLowerCase()],
  );

  if (!rows.length) return;

  // Group by source, compute MAE on average temp (high+low)/2
  const bySource: Record<string, number[]> = {};
  for (const r of rows) {
    const predAvg = (Number(r.pred_high) + Number(r.pred_low)) / 2;
    const actAvg = (Number(r.act_high) + Number(r.act_low)) / 2;
    if (!bySource[r.source]) bySource[r.source] = [];
    bySource[r.source].push(Math.abs(predAvg - actAvg));
  }

  for (const [source, errors] of Object.entries(bySource)) {
    const mae = errors.reduce((s, e) => s + e, 0) / errors.length;
    // 0 MAE → 100 score; 10°C MAE → 0 score
    const accuracyScore = Math.max(0, Math.round(100 - mae * 10));

    await query(
      `INSERT INTO source_accuracy (source, location, mae, accuracy_score, sample_count, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (source, location) DO UPDATE
         SET mae           = EXCLUDED.mae,
             accuracy_score = EXCLUDED.accuracy_score,
             sample_count  = EXCLUDED.sample_count,
             updated_at    = NOW()`,
      [source, location.toLowerCase(), mae.toFixed(3), accuracyScore, errors.length],
    );
  }
}

export async function computeAllLocations(): Promise<void> {
  const locations = await query<{ location: string }>(
    `SELECT DISTINCT location FROM predictions`,
  );
  await Promise.all(locations.map(r => computeAndSaveAccuracy(r.location)));
}
