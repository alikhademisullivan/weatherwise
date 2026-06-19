import { query, dbEnabled } from './pool';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS location_feedback (
  id            SERIAL PRIMARY KEY,
  city          VARCHAR(200)   NOT NULL,
  latitude      NUMERIC(9,6),
  longitude     NUMERIC(9,6),
  feedback_type VARCHAR(50)    NOT NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_city
  ON location_feedback (city, created_at DESC);

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'predictions_source_location_date_uq'
  ) THEN
    ALTER TABLE predictions ADD CONSTRAINT predictions_source_location_date_uq UNIQUE (source, location, for_date);
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS user_feedback (
  id          SERIAL PRIMARY KEY,
  rating      SMALLINT       NOT NULL CHECK (rating >= 1 AND rating <= 5),
  category    VARCHAR(50)    NOT NULL,
  comment     TEXT,
  email       VARCHAR(255),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255)   NOT NULL UNIQUE,
  password_hash VARCHAR(255)   NOT NULL,
  display_name  VARCHAR(100),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_locations (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       VARCHAR(200)   NOT NULL,
  city        VARCHAR(200)   NOT NULL,
  lat         NUMERIC(9,6),
  lon         NUMERIC(9,6),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, city)
);

CREATE TABLE IF NOT EXISTS netatmo_tokens (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    BIGINT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id = 1)
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
