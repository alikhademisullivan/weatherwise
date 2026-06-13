# WeatherWise

> **The weather app that tells you when to trust the forecast.**

WeatherWise pulls forecasts from multiple weather APIs, computes a weighted consensus reading, and surfaces a **Forecast Dispute** indicator when sources strongly disagree — so you know exactly how much confidence to place in the forecast.

---

## Features

- **Weighted Consensus** — aggregates multiple weather sources into a single reading, weighted by source accuracy (equal weighting in Phase 1, adaptive in Phase 3)
- **Forecast Dispute Indicator** — detects when sources spread >3 °C and shows an amber/red badge with plain-English explanation
- **Confidence Bar** — 0–100% visual agreement meter ("Strong Agreement" / "Moderate" / "Disputed")
- **Source Breakdown Panel** — toggle to see each source's reading side-by-side, with the outlier highlighted
- **7-Day Forecast Chart** — high/low trend lines with per-day spread bands and precipitation overlay
- **°C / °F Toggle** — convert at display time; all internals use Celsius
- **In-memory cache** — 10-minute TTL per city to stay within free-tier rate limits
- **Graceful degradation** — if one source fails, the others still contribute
- **Rich stat card tooltips** — hover (desktop) or tap (mobile) on any stat card to see a per-source breakdown with a mini bar chart, identity-coloured bars per source, closest-to-consensus checkmark, outlier warning, trend arrows, and plain-English interpretation
- **AI weather chat** — ask free-text questions grounded in live consensus + 7-day forecast data; powered by Groq / LLaMA 3.3 70B with multi-turn conversation history
- **Location feedback** — rate how accurate today's forecast was; aggregated ratings feed back as AI-generated city-specific insights
- **Browser push notifications** — opt-in alerts for high-confidence rain and disputed forecasts
- **Share card** — one-tap share (Web Share API with clipboard fallback) that packages current conditions and source agreement into a shareable text snippet
- **Extended details** — UV index, pressure, visibility, cloud cover, sunrise/sunset with golden hour times; all backed by per-source data
- **Weather alerts** — severe weather alert banner from NWS/NOAA when available
- **Honest forecast confidence** — days 1–3 show precise temps; days 4–7 show wider bands because precision that far out is unreliable
- **Best time widget** — scores every hour 0–100 for outdoor activity (temperature, precipitation, wind, condition) and surfaces the best 2-hour window
- **City autocomplete** — coordinate-based disambiguation for same-name cities

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Data fetching | TanStack Query (React Query v5) |
| Routing | React Router v6 |
| Backend | Node.js + Express, TypeScript |
| AI | Groq SDK, LLaMA 3.3 70B Versatile |
| Database | PostgreSQL (optional) |
| HTTP client | Axios |
| Cache | node-cache (in-memory) |
| Dev tooling | tsx, concurrently, Vitest |

---

## Project Structure

```
weatherwise/
├── client/                        # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── DetailsPanel.tsx        # 9 stat tiles (hero + details modes)
│   │   │   ├── StatTooltip.tsx         # Portal-based hover/tap tooltip with per-source bar chart
│   │   │   ├── ConfidenceBar.tsx       # Agreement meter
│   │   │   ├── DisputeBadge.tsx        # High uncertainty indicator
│   │   │   ├── SourceBreakdown.tsx     # Per-source temperature table with outlier highlight
│   │   │   ├── ForecastChart.tsx       # 7-day chart with confidence tiers
│   │   │   ├── HourlyChart.tsx         # 24-hour forecast strip
│   │   │   ├── BestTimeWidget.tsx      # Hourly outdoor activity scorer
│   │   │   ├── AIChatDrawer.tsx        # Bottom-sheet AI chat with conversation history
│   │   │   ├── LocationFeedback.tsx    # Forecast accuracy ratings + aggregate display
│   │   │   ├── NotificationOptIn.tsx   # Browser push notification opt-in
│   │   │   ├── ShareCard.tsx           # Web Share API + clipboard fallback
│   │   │   ├── AccuracyLeaderboard.tsx # Per-source MAE and weight display
│   │   │   ├── AirQuality.tsx          # AQI with EPA category colours
│   │   │   ├── SunArc.tsx              # Sunrise/sunset arc with current time
│   │   │   ├── SmartSummary.tsx        # Plain-English consensus summary
│   │   │   ├── AlertsBanner.tsx        # Severe weather alert strip
│   │   │   └── SearchBar.tsx           # City search with autocomplete
│   │   ├── hooks/
│   │   │   └── useWeatherConsensus.ts  # TanStack Query hooks for all endpoints
│   │   ├── utils/
│   │   │   └── formatters.ts           # Temp units, dates, compass, UV risk
│   │   ├── types/
│   │   │   └── weather.ts              # Shared TypeScript interfaces
│   │   ├── App.tsx                     # Main dashboard
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts             # Dev proxy → localhost:3001
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                        # Express backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── weather.ts          # current, forecast, hourly, accuracy, alerts, feedback
│   │   │   └── ask.ts              # POST /api/weather/ask (AI chat)
│   │   ├── services/
│   │   │   ├── openMeteo.ts        # Open-Meteo adapter (no key required)
│   │   │   ├── openWeatherMap.ts   # OpenWeatherMap adapter
│   │   │   ├── tomorrowIo.ts       # Tomorrow.io adapter
│   │   │   ├── weatherApi.ts       # WeatherAPI.com adapter
│   │   │   ├── consensus.ts        # Weighted average, dispute detection, field spreads
│   │   │   └── groqDecision.ts     # Groq/LLaMA context builder + chat completion
│   │   ├── db/
│   │   │   ├── migrations.ts       # predictions, actuals, accuracy, feedback schema
│   │   │   ├── accuracy.ts         # MAE calculation and dynamic weight queries
│   │   │   ├── feedback.ts         # Location feedback storage and aggregation
│   │   │   └── pool.ts             # PostgreSQL connection pool
│   │   ├── types/
│   │   │   └── weather.ts          # Server-side type definitions
│   │   └── index.ts                # Express app entry point
│   ├── tsconfig.json
│   └── package.json
│
├── .env.example                   # Environment variable template
├── package.json                   # Workspace root + concurrently
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js v18+** (v22 recommended)
- **npm v9+**
- An **OpenWeatherMap API key** (free at [openweathermap.org](https://openweathermap.org/api)) — optional; Open-Meteo works without any key

### 1. Clone and install

```bash
git clone https://github.com/alikhademisullivan/weatherwise.git
cd weatherwise
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
PORT=3001
OPENWEATHERMAP_API_KEY=your_key_here   # optional but recommended
CACHE_TTL_SECONDS=600                  # 10 minutes
DISPUTE_THRESHOLD_CELSIUS=3            # spread > 3°C triggers dispute badge
```

> Open-Meteo requires **no API key** and is always used. OpenWeatherMap is used automatically when `OPENWEATHERMAP_API_KEY` is set.

### 3. Run in development

```bash
npm run dev
```

This starts both servers concurrently:
- **Backend** → `http://localhost:3001`
- **Frontend** → `http://localhost:5173` (proxies `/api` to the backend)

Open `http://localhost:5173` in your browser.

---

## API Reference

### `GET /api/weather/current?city=<city>`

Returns the consensus reading and per-source breakdown for the current conditions.

```json
{
  "location": "Toronto",
  "consensus": {
    "temperature": 18.2,
    "feelsLike": 16.8,
    "humidity": 62,
    "windSpeed": 14.3,
    "precipitationProbability": 25,
    "condition": "Partly Cloudy",
    "sources": [...],
    "spread": 2.1,
    "confidenceScore": 86,
    "isDisputed": false,
    "disputeMessage": "Sources are in good agreement on today's forecast.",
    "location": "Toronto",
    "updatedAt": "2025-06-11T14:00:00.000Z"
  },
  "sources": [
    {
      "source": "Open-Meteo",
      "temperature": 17.4,
      "feelsLike": 15.9,
      "humidity": 65,
      "windSpeed": 12.0,
      "precipitationProbability": 20,
      "condition": "Partly Cloudy",
      "conditionCode": "partly_cloudy",
      "fetchedAt": "2025-06-11T14:00:00.000Z"
    }
  ],
  "updatedAt": "2025-06-11T14:00:00.000Z"
}
```

### `GET /api/weather/forecast?city=<city>&days=7`

Returns a merged 7-day forecast with spread bands from all sources and honest confidence tiers.

### `GET /api/weather/hourly?city=<city>`

Returns 24-hour hourly forecast (temperature, precipitation probability, wind speed, condition).

### `GET /api/weather/accuracy?city=<city>`

Returns per-source rolling 30-day MAE, accuracy scores (0–100), and current consensus weights.

### `GET /api/weather/alerts?city=<city>`

Returns active severe weather alerts from NWS/NOAA (US cities). Empty array outside the US.

### `GET /api/weather/feedback-summary?city=<city>`

Returns aggregated user feedback totals and an AI-generated insight (once ≥ 5 reports exist).

### `POST /api/weather/feedback`

Body: `{ city, lat, lon, type }` where `type` is one of `accurate | too_warm | too_cold | missed_rain | false_rain`.

### `POST /api/weather/ask`

Body: `{ city, question, history? }`. Returns `{ answer, city, question }`. Requires `GROQ_API_KEY`. History is an array of `{ role: "user" | "assistant", content: string }` capped at 8 entries.

### `GET /api/health`

Health check: `{ "status": "ok", "timestamp": "..." }`

---

## Consensus & Dispute Logic

### How consensus is computed

Each source returns a `SourceReading` with normalized fields (Celsius, km/h, etc.). The consensus layer:

1. **Weighted average** — each numeric field (temp, humidity, wind, precip) is averaged using source weights (currently 1.0 for all, tunable in Phase 3)
2. **Majority-vote condition** — the most-weighted condition string wins ("Rain", "Partly Cloudy", etc.)
3. **Spread** — `max(temps) - min(temps)` across all sources
4. **Confidence score** — `max(0, 100 - (spread / 10) * 100)`

### Dispute thresholds

| Condition | Badge | Message |
|---|---|---|
| Spread > 5°C | 🔴 High Uncertainty | "Sources strongly disagree — treat this forecast with caution." |
| Spread > 3°C | ⚠️ Forecast Disputed | "Sources are split on temperature — pack layers just in case." |
| Precip spread > 30% | ⚠️ Forecast Disputed | "Sources can't agree on rain chances — bring an umbrella." |
| No dispute | ✓ (green) | "Sources are in good agreement on today's forecast." |

The threshold is configurable via `DISPUTE_THRESHOLD_CELSIUS` in `.env`.

---

## Running Tests

```bash
# All tests
npm test

# Server tests only
npm test --workspace=server

# Client tests only
npm test --workspace=client
```

---

## Build for Production

```bash
npm run build
```

- **Server** → `server/dist/` (compiled JS, run with `node dist/index.js`)
- **Client** → `client/dist/` (static assets, serve with any static host or nginx)

To run the built server:

```bash
cd server && node dist/index.js
```

---

## Weather Sources

| Source | Key Required | Coverage | Notes |
|---|---|---|---|
| **Open-Meteo** | No | Global | Geocoding via their free geocoding API |
| **OpenWeatherMap** | Yes (free tier) | Global | 1,000 calls/day free |
| **Tomorrow.io** | Yes | Global | Phase 2 — probabilistic forecasts |
| **WeatherAPI.com** | Yes | Global | Phase 2 — air quality, astronomy |

---

## Development Phases

### Phase 1 — MVP
- [x] Express server with Open-Meteo + OpenWeatherMap adapters
- [x] Consensus and dispute logic
- [x] In-memory cache
- [x] React frontend: dashboard, confidence bar, dispute badge, source breakdown
- [x] 7-day forecast with spread visualization
- [x] City search
- [x] Unit tests for consensus logic

### Phase 2 — Polish
- [x] Tomorrow.io and WeatherAPI.com adapters (all 4 sources active)
- [x] Geolocation (`navigator.geolocation` + reverse geocode)
- [x] 24-hour hourly forecast view (daily/hourly toggle)
- [x] Animated weather condition backgrounds

### Phase 3 — Smart Weighting
- [x] PostgreSQL: predictions table records each source's day+1 forecast
- [x] Actuals table populated nightly via Open-Meteo `past_days=1`
- [x] Rolling 30-day MAE computed per source per city (nightly cron at 02:15)
- [x] Accuracy scores fed back into consensus weighted average dynamically
- [x] `GET /api/weather/accuracy` endpoint exposes scores + active weights
- [x] Accuracy leaderboard UI with per-source score bar and weight multiplier
- [x] Accuracy badge shown inline in source breakdown panel
- [x] Green dot indicator in header when dynamic weights are active

### Phase 4 — Extended Details & Smart UI
- [x] Extended `SourceReading` and `ConsensusReading` with UV index, pressure, dew point, visibility, wind gust, wind direction, cloud cover, precipitation mm, sunrise/sunset times, moon phase, air quality
- [x] `fieldSpreads` object on consensus for per-field source disagreement tracking
- [x] Secondary stats strip (UV, pressure, visibility, cloud cover, sunrise/sunset) with warn indicators
- [x] Severe weather alerts banner (`GET /api/weather/alerts`) via NWS/NOAA
- [x] Smart summary sentence derived from consensus + forecast data
- [x] Sun arc visualisation with current time position and moon phase
- [x] Air quality card with AQI scale and EPA category colours
- [x] Best time widget scoring hourly windows 0–100 for outdoor activity
- [x] Honest forecast confidence tiers — day 1–3 precise, day 4–7 range-only
- [x] City autocomplete with coordinate-based disambiguation
- [x] Animated condition backgrounds (clear, rain, snow, thunderstorm, fog, etc.)

### Phase 5 — AI, Feedback & Social
- [x] Groq/LLaMA 3.3 70B AI chat grounded in live consensus + 7-day forecast
- [x] Multi-turn conversation history (capped at 8 messages)
- [x] Suggested prompt chips on first open
- [x] Location feedback (5 rating types: accurate / too warm / too cold / missed rain / no rain came)
- [x] Feedback aggregation with bar-chart breakdown and AI-generated city insight (≥ 5 reports)
- [x] Browser push notifications opt-in — rain alert (≥ 70% precip + ≥ 70 confidence) and dispute alert
- [x] Share card — Web Share API with clipboard fallback, formats conditions + confidence
- [x] Rich stat card tooltips (`StatTooltip`) with per-source bar chart, identity colours, outlier detection, trend arrows, portal-based positioning that escapes `overflow: hidden` containers

---

## Phase 3 Setup — PostgreSQL

Phase 3 is fully optional. Without `DATABASE_URL`, the app uses equal weights.

### Local PostgreSQL (quick start)

```bash
# macOS
brew install postgresql@16 && brew services start postgresql@16

# Ubuntu / Debian
sudo apt install postgresql && sudo systemctl start postgresql
```

```bash
createdb weatherwise
```

Add to your `.env`:
```bash
DATABASE_URL=postgresql://localhost/weatherwise
```

The server runs migrations automatically on startup — no manual SQL needed.

### Hosted PostgreSQL

Works out of the box with [Supabase](https://supabase.com), [Render](https://render.com), [Railway](https://railway.app), or [Neon](https://neon.tech) (all have free tiers).

```bash
DATABASE_URL=postgresql://user:password@host:5432/weatherwise
DATABASE_SSL=true   # required for most hosted providers
```

### How accuracy tracking works

1. On every `/api/weather/forecast` call, each source's predicted high/low for **tomorrow** is stored in the `predictions` table.
2. Every night at **02:15**, a cron job fetches yesterday's actual temperature from Open-Meteo's historical endpoint (`past_days=1`) and upserts it into the `actuals` table.
3. For each (source, city) pair, the job computes **30-day rolling MAE** (mean absolute error on the daily average temperature).
4. `accuracy_score = max(0, 100 - MAE × 10)` — a source with 0°C error scores 100%, 10°C error scores 0%.
5. The consensus `buildConsensus()` call loads these scores as weights: higher accuracy → more influence on the final temperature.
6. Weights have a floor of 0.1 so no source is completely silenced while it's still learning.

---

## Phase 5 Setup — AI Chat

AI chat is optional. Without `GROQ_API_KEY` the `/api/weather/ask` endpoint returns 503 and the Ask AI button simply shows an error message.

1. Create a free account at [console.groq.com](https://console.groq.com)
2. Generate an API key
3. Add to `.env`:
```bash
GROQ_API_KEY=your_key_here
```

The endpoint uses `llama-3.3-70b-versatile` (Groq's free tier). Responses are capped at 300 tokens — 2–4 sentences max. Live weather data is fetched fresh on every question so the AI always has current conditions and the full 7-day forecast as grounded context.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express server port |
| `OPENWEATHERMAP_API_KEY` | — | OWM API key (free tier: 1k calls/day) |
| `TOMORROW_IO_API_KEY` | — | Tomorrow.io API key (free tier: 500 calls/day) |
| `WEATHERAPI_KEY` | — | WeatherAPI.com key (free tier: 1M calls/month) |
| `CACHE_TTL_SECONDS` | `600` | Cache lifetime per city in seconds |
| `DISPUTE_THRESHOLD_CELSIUS` | `3` | Spread (°C) that triggers the dispute badge |
| `DATABASE_URL` | — | PostgreSQL connection string (Phase 3+, optional) |
| `DATABASE_SSL` | — | Set to `true` for hosted Postgres providers |
| `GROQ_API_KEY` | — | Groq API key for AI chat (Phase 5, optional) |

---

## Contributing

1. Fork the repo and create your branch from `main`
2. Run `npm install` at the repo root
3. Make your changes with TypeScript throughout
4. Run `npm test` to verify all tests pass
5. Submit a pull request with a clear description
