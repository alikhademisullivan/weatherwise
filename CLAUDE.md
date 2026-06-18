# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs client on :5173 and server on :3001 concurrently)
npm run dev

# Build (compiles server TS → dist/, bundles client via Vite)
npm run build

# Production start (serves built client as static files)
npm run start

# Tests (vitest in both workspaces)
npm run test
npm run test --workspace=client
npm run test --workspace=server

# Lint (ESLint in both workspaces)
npm run lint
```

## Architecture

npm workspaces monorepo with two packages:
- **`client/`** — React 18 + Vite + TypeScript SPA
- **`server/`** — Express + Node.js + TypeScript API

In development, Vite proxies `/api` requests to `http://localhost:3001`. In production, Express serves the built React app as static files and handles all API routes.

### Server (`server/src/`)

Entry point: `server/src/index.ts` — sets up Express, runs DB migrations, mounts routes, schedules cron jobs.

**Routes:**
- `routes/weather.ts` — all `/api/weather/*` endpoints (current, forecast, hourly, radar, etc.)
- `routes/ask.ts` — `/api/weather/ask` AI chat, rate-limited to 10 req/min via express-rate-limit

**Services** (`server/src/services/`):
- `openMeteo.ts`, `openWeatherMap.ts`, `tomorrowIo.ts`, `weatherApi.ts` — one file per external weather provider
- `consensus.ts` — weighted aggregation of all provider readings into a `ConsensusReading` with confidence score and dispute detection
- `groqDecision.ts` — AI chat via Groq SDK (key: `GROQ_API_KEY`)
- `emailDigest.ts` — daily digest email via Nodemailer

**Database** (`server/src/db/`) — PostgreSQL, optional. If `DATABASE_URL` is not set, all sources default to equal weight (1.0). When present:
- `pool.ts` — connection pool
- `migrations.ts` — auto-creates tables on startup
- `accuracy.ts` / `predictions.ts` / `actuals.ts` / `feedback.ts` — accuracy backtesting; sources with lower rolling MAE get higher consensus weight

**Cache:** `server/src/cache/weatherCache.ts` — NodeCache with configurable `CACHE_TTL_SECONDS` (default 10 min).

**Cron jobs** (`server/src/jobs/`):
- `accuracyCron.ts` — records actual observed temps and updates source accuracy scores
- `digestCron.ts` — sends daily email digest at 6 AM; subscriptions stored in `data/digest_subscriptions.json`

### Client (`client/src/`)

Entry point: `client/src/main.tsx` — wraps app in `BrowserRouter` + `QueryClientProvider` (5min staleTime, retry×2).

**State management:**
- React Query for all server state (weather data, forecasts)
- `useState` for local UI state (selected city, theme, active panels)
- `localStorage` for persisted preferences (saved locations, theme, commute times, custom alerts)

**Key hooks** (`client/src/hooks/`):
- `useWeatherConsensus.ts` — main hook, drives `GET /api/weather/current` and returns consensus data
- `useSavedLocations.ts` — localStorage-backed list of pinned cities
- `useLocation.ts` — browser geolocation with fallback

**Component structure** (`client/src/components/`) — 30+ components organized by domain: weather display (ConsensusCard, SourceBreakdown, ConfidenceBar), forecast (ForecastChart, HourlyChart, PrecipTimeline), maps (RadarMap via Leaflet + RainViewer), planning (WeekendPlanner, CommuteMode), and engagement (AIChatDrawer, CustomAlerts, DigestSubscribe).

**Styling:** Tailwind CSS with a custom `sky-950: #0c1a2e` color; dark/light theme toggle stored in localStorage.

### Shared types

Both `client/src/types/weather.ts` and `server/src/types/weather.ts` define the same core types:
- `SourceReading` — one provider's data snapshot
- `ConsensusReading` — weighted average + confidence score + dispute flag
- `ForecastDay` — high/low with confidence tier (high/medium/low)
- `FeedbackType` — `accurate | too_warm | too_cold | missed_rain | false_rain`

When changing these types, update both copies.

## Environment

Copy `.env.example` to `.env` in the root. Only `OPENMETEO` is free/always-on; the other three providers are optional but improve consensus quality:

```
OPENWEATHERMAP_API_KEY=
TOMORROWIO_API_KEY=
WEATHERAPI_KEY=
GROQ_API_KEY=        # Required for AI chat (/api/weather/ask)
DATABASE_URL=        # Optional PostgreSQL; enables accuracy-weighted consensus
SMTP_HOST=           # Optional; enables daily digest emails
```

## Deployment

Configured for Render via `render.yaml`. Build command: `npm run build`. Start command: `npm run start`. The server serves the compiled React SPA from `client/dist/` as static files with a catch-all for SPA routing.
