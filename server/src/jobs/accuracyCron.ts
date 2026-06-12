import cron from 'node-cron';
import { getUniqueLocations } from '../db/predictions';
import { upsertActual } from '../db/actuals';
import { computeAndSaveAccuracy } from '../db/accuracy';
import { getYesterdaysActual } from '../services/openMeteo';
import { dbEnabled } from '../db/pool';

export async function runAccuracyJob(): Promise<void> {
  if (!dbEnabled()) return;

  console.log('[AccuracyJob] Starting run…');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  const locations = await getUniqueLocations();
  console.log(`[AccuracyJob] Processing ${locations.length} locations for ${dateStr}`);

  for (const loc of locations) {
    try {
      const actual = await getYesterdaysActual(loc.latitude, loc.longitude);
      if (!actual) {
        console.warn(`[AccuracyJob] No actual data for ${loc.location} on ${dateStr}`);
        continue;
      }

      await upsertActual(loc.location, dateStr, actual.high, actual.low, actual.condition);
      await computeAndSaveAccuracy(loc.location);

      console.log(`[AccuracyJob] ✓ ${loc.location} — actual H:${actual.high} L:${actual.low}`);
    } catch (err) {
      console.error(`[AccuracyJob] Error for ${loc.location}:`, err);
    }
  }

  console.log('[AccuracyJob] Run complete');
}

export function scheduleAccuracyCron(): void {
  if (!dbEnabled()) return;

  // Run every night at 2:15am — data for yesterday should be available by then
  cron.schedule('15 2 * * *', () => {
    runAccuracyJob().catch(err => console.error('[AccuracyJob] Unhandled error:', err));
  });

  console.log('[AccuracyJob] Scheduled nightly at 02:15');
}
