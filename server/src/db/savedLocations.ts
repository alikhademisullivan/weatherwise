import { query } from './pool';

export interface SavedLocation {
  label: string;
  city: string;
  lat: number | null;
  lon: number | null;
}

export async function getSavedLocations(userId: number): Promise<SavedLocation[]> {
  return query<SavedLocation>(
    `SELECT label, city, lat::float AS lat, lon::float AS lon
     FROM saved_locations WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId],
  );
}

export async function addSavedLocation(
  userId: number,
  label: string,
  city: string,
  lat: number | null,
  lon: number | null,
): Promise<void> {
  await query(
    `INSERT INTO saved_locations (user_id, label, city, lat, lon)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, city) DO UPDATE SET label = EXCLUDED.label`,
    [userId, label, city, lat, lon],
  );
}

export async function removeSavedLocation(userId: number, city: string): Promise<void> {
  await query(
    `DELETE FROM saved_locations WHERE user_id = $1 AND city = $2`,
    [userId, city],
  );
}
