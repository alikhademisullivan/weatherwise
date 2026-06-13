import { query, dbEnabled } from './pool';

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

export async function recordFeedback(
  city: string,
  lat: number | null,
  lon: number | null,
  feedbackType: FeedbackType,
): Promise<void> {
  if (!dbEnabled()) return;
  await query(
    `INSERT INTO location_feedback (city, latitude, longitude, feedback_type)
     VALUES ($1, $2, $3, $4)`,
    [city.toLowerCase(), lat, lon, feedbackType],
  );
}

export async function getFeedbackSummary(city: string): Promise<FeedbackSummary> {
  const empty: FeedbackSummary = {
    total: 0, accurate: 0, too_warm: 0, too_cold: 0, missed_rain: 0, false_rain: 0, insight: null,
  };

  if (!dbEnabled()) return empty;

  const rows = await query<{ feedback_type: string; count: string }>(
    `SELECT feedback_type, COUNT(*) as count
     FROM location_feedback
     WHERE city = $1 AND created_at > NOW() - INTERVAL '30 days'
     GROUP BY feedback_type`,
    [city.toLowerCase()],
  );

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    const n = parseInt(row.count, 10);
    counts[row.feedback_type] = n;
    total += n;
  }

  const summary: FeedbackSummary = {
    total,
    accurate: counts['accurate'] ?? 0,
    too_warm: counts['too_warm'] ?? 0,
    too_cold: counts['too_cold'] ?? 0,
    missed_rain: counts['missed_rain'] ?? 0,
    false_rain: counts['false_rain'] ?? 0,
    insight: null,
  };

  if (total >= 5) {
    const missedRainRate = summary.missed_rain / total;
    const falseRainRate = summary.false_rain / total;
    const tooWarmRate = summary.too_warm / total;
    const tooColdRate = summary.too_cold / total;
    const accurateRate = summary.accurate / total;

    if (missedRainRate >= 0.4) {
      summary.insight = 'Sources tend to miss rain in your area — we apply a correction.';
    } else if (falseRainRate >= 0.4) {
      summary.insight = "Sources often predict rain that doesn't arrive here — take rain forecasts lightly.";
    } else if (tooWarmRate >= 0.4) {
      summary.insight = 'Forecasts often run warm for your location — expect it to feel cooler.';
    } else if (tooColdRate >= 0.4) {
      summary.insight = 'Forecasts often run cold for your location — expect it to feel warmer.';
    } else if (accurateRate >= 0.7) {
      summary.insight = 'Forecasts have been quite accurate for your location recently.';
    }
  }

  return summary;
}
