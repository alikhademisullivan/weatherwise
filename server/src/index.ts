import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import weatherRouter from './routes/weather';
import { runMigrations } from './db/migrations';
import { scheduleAccuracyCron } from './jobs/accuracyCron';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

app.use('/api/weather', weatherRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  await runMigrations();
  scheduleAccuracyCron();

  app.listen(PORT, () => {
    console.log(`WeatherWise server running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
