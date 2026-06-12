import { query, dbEnabled } from './pool';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS predictions (
  id          SERIAL PRIMARY KEY,
  source      VARCHAR(100)   NOT NULL,
  location    VARCHAR(200)   NOT NULL,
  latitude    NUMERIC(9,6)   NOT NULL,
  longitude   NUMERIC(9,6)   NOT NULL,
  for_date    DATE           NOT NULL,
  temp_high   NUMERIC(5,2)   NOT NULL,
  temp_low    NUMERIC(5,2)   NOT NULL,
  condition   VARCHAR(100),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_location_date
  ON predictions (location, for_date);

CREATE TABLE IF NOT EXISTS actuals (
  id          SERIAL PRIMARY KEY,
  location    VARCHAR(200)   NOT NULL,
  actual_date DATE           NOT NULL,
  temp_high   NUMERIC(5,2)   NOT NULL,
  temp_low    NUMERIC(5,2)   NOT NULL,
  condition   VARCHAR(100),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (location, actual_date)
);

CREATE TABLE IF NOT EXISTS source_accuracy (
  source        VARCHAR(100)  NOT NULL,
  location      VARCHAR(200)  NOT NULL,
  mae           NUMERIC(6,3)  NOT NULL,
  accuracy_score NUMERIC(5,2) NOT NULL,
  sample_count  INTEGER       NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, location)
);
`;

export async function runMigrations(): Promise<void> {
  if (!dbEnabled()) {
    console.log('[DB] DATABASE_URL not set — skipping migrations, using equal weights');
    return;
  }
  try {
    await query(SCHEMA);
    console.log('[DB] Migrations applied');
  } catch (err) {
    console.error('[DB] Migration error:', err);
  }
}
