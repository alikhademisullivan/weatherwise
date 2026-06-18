import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import weatherRouter from './routes/weather';
import askRouter from './routes/ask';
import authRouter from './routes/auth';
import { runMigrations } from './db/migrations';
import { scheduleAccuracyCron, runAccuracyJob } from './jobs/accuracyCron';
import { scheduleDigestCron } from './jobs/digestCron';

const app = express();
const PORT = process.env.PORT ?? 3001;

const allowedOrigins = [
  process.env.APP_URL,
  'http://localhost:5173',
  'http://localhost:3001',
].filter(Boolean) as string[];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cookieParser());
app.use(express.json({ limit: '16kb' }));

const weatherLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});

app.use('/api/auth', authRouter);
app.use('/api/weather', weatherLimiter, weatherRouter);
app.use('/api/weather/ask', aiLimiter, askRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

async function start() {
  await runMigrations();
  scheduleAccuracyCron();
  scheduleDigestCron();

  // Backfill accuracy on every startup so data appears without waiting for the 2:15am cron
  runAccuracyJob().catch(err => console.error('[AccuracyJob] Startup run failed:', err));

  app.listen(PORT, () => {
    console.log(`WeatherWise server running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
