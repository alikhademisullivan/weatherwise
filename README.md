# WeatherWise

A full-stack weather aggregator that combines multiple forecast sources into a single consensus reading, tracks prediction accuracy over time, and surfaces honest uncertainty to the user.

## Features

### Core Consensus Engine
- Aggregates **Open-Meteo**, **Tomorrow.io**, and **WeatherAPI** into a single weighted consensus
- Computes a **confidence score** (0–100) based on inter-source agreement
- Shows a **dispute badge** when sources meaningfully disagree
- Confidence bar colour-codes certainty at a glance
- Dynamic weights: sources with better rolling accuracy receive higher weight

### Forecast
- **7-day or 14-day** daily forecast (days 8–14 shown with explicit confidence tiers: high / medium / low / trend-only)
- **Hourly forecast** for the next 48 h with temperature + precipitation bars
- **Extended hourly** hook — up to 7 days of hourly data for deeper views
- ForecastChart (Recharts) with switchable daily/hourly view

### Radar Map
- Animated precipitation radar powered by **Leaflet** + **RainViewer** free API
- Dark CartoDB basemap centred on the searched city
- Play / pause / manual scrubber across past radar frames

### Precipitation Timeline
- 24-hour bar chart of rain probability (colour-coded by intensity: blue-100 → blue-400)
- Highlights peak probability and shows per-hour mm/hr on hover

### Weekend Planner
- Dedicated **📅** view showing Saturday and Sunday side-by-side
- Each day card: high/low, rain %, UV index, wind gusts, confidence pill (high / some uncertainty / trend only)
- Hourly rain bars for each day when data is available

### Commute Mode
- Configure **morning departure** and **evening return** times (persisted to localStorage)
- Shows conditions, rain probability, wind speed, and a one-line recommendation for each commute slot

### Historical Comparison
- Yesterday's actual high/low + same date one year ago via **Open-Meteo historical API**
- Temp delta vs. today's forecast shown in red/blue

### Saved Locations
- Pin any city with the ★ button in the header
- Saved cities appear as chips — click to switch instantly, × to remove
- Persisted to localStorage via `useSavedLocations` hook

### Custom Alerts
- User-defined notification thresholds: **wind speed**, **rain probability**, **temperature low**, **source disagreement**
- Fires browser `Notification` API when conditions are met (deduped per session per city)
- Thresholds persist to localStorage

### Daily Digest Email
- Subscribe with any email address to receive a morning summary at **6:00 AM daily**
- Server-side cron job (node-cron) builds a plain-text digest from live forecast data
- File-backed subscriber store (`data/digest_subscriptions.json`)
- Unsubscribe endpoint removes the record immediately

### Dark / Light Theme
- Toggle between dark (default) and light mode with ☀️ / 🌙 button in the header
- Preference persisted to localStorage and applied via `html.classList`

### AI Chat Drawer
- Claude-powered assistant that answers questions about the current forecast
- Pre-built prompt chips for common questions
- Thumbs up/down feedback on AI answers
- Responses reference actual consensus data pulled live

### Accuracy Tracking
- PostgreSQL table records daily predictions at fetch time
- Rolling accuracy score computed per source, displayed in an Accuracy Leaderboard
- Accuracy scores feed back into consensus weighting

### Additional UI
- **Feels-like** temperature displayed inline with hero temperature
- **Sun arc** animation showing current position in the day
- **Air quality** index card
- **Alerts banner** for severe weather from source APIs
- **Location feedback** panel (thumbs up/down on forecast quality)
- **Share card** — copy a plain-text summary of current conditions
- **Smart summary** — one-line natural-language description of conditions
- **Stat tooltips** — rich detail on hover for each weather metric
- **Best time widget** — estimated best window to go outside
- Press **`/`** anywhere to focus the city search bar

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Charts | Recharts |
| Map | Leaflet, RainViewer API |
| State / Data | TanStack Query (React Query) |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (prediction accuracy tracking) |
| AI | Claude API (Anthropic) |
| Weather APIs | Open-Meteo (free), Tomorrow.io, WeatherAPI |
| Email cron | node-cron + Nodemailer |

## API Endpoints

```
GET    /api/weather/current                  Current conditions (consensus)
GET    /api/weather/forecast                 Daily forecast (?days=7 or 14)
GET    /api/weather/hourly                   Hourly forecast (?days=1–7)
GET    /api/weather/alerts                   Severe weather alerts
GET    /api/weather/accuracy                 Rolling accuracy leaderboard
GET    /api/weather/precipitation-timeline   24h hourly rain probability
GET    /api/weather/historical               Yesterday + last year high/low
GET    /api/weather/feedback-summary         Aggregated user feedback for a city
GET    /api/weather/geocode/search           City autocomplete / coordinate lookup

POST   /api/weather/ai-chat                  Claude AI weather Q&A
POST   /api/weather/feedback                 Submit a forecast quality vote
POST   /api/weather/ai-feedback              Rate an AI chat response (up/down)
POST   /api/weather/digest/subscribe         Subscribe to daily email digest
DELETE /api/weather/digest/unsubscribe       Remove digest subscription
```

## Project Structure

```
weatherwise/
├── client/              React + Vite frontend
│   └── src/
│       ├── components/  UI components
│       ├── hooks/       Data fetching hooks (useWeatherConsensus, useSavedLocations, …)
│       └── types/       Shared TypeScript types
└── server/              Express backend
    └── src/
        ├── routes/      weather.ts — all API route handlers
        ├── services/    openMeteo.ts, tomorrowIo.ts, emailDigest.ts
        └── jobs/        digestCron.ts — 6 AM daily digest scheduler
```

## Environment Variables

```bash
# Server
TOMORROW_IO_API_KEY=
WEATHER_API_KEY=
ANTHROPIC_API_KEY=
DATABASE_URL=postgresql://user:pass@host:5432/weatherwise
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
APP_URL=https://your-domain.com   # used by digest cron for internal API calls

# Client (Vite)
VITE_API_BASE_URL=/api
```

## Getting Started

```bash
# Install all dependencies
npm install

# Start client and server in dev mode
npm run dev

# Build for production
npm run build
```

The server runs on port `3001` by default. The Vite dev server proxies `/api` requests to it automatically.
