import { useState } from 'react';
import SearchBar from './components/SearchBar';
import ConfidenceBar from './components/ConfidenceBar';
import DisputeBadge from './components/DisputeBadge';
import DetailsPanel from './components/DetailsPanel';
import SourceBreakdown from './components/SourceBreakdown';
import ForecastChart from './components/ForecastChart';
import HourlyChart from './components/HourlyChart';
import AccuracyLeaderboard from './components/AccuracyLeaderboard';
import AlertsBanner from './components/AlertsBanner';
import SmartSummary from './components/SmartSummary';
import SunArc from './components/SunArc';
import AirQuality from './components/AirQuality';
import BestTimeWidget from './components/BestTimeWidget';
import LocationFeedback from './components/LocationFeedback';
import NotificationOptIn from './components/NotificationOptIn';
import ShareCard from './components/ShareCard';
import AIChatDrawer from './components/AIChatDrawer';
import { conditionCodeToEmoji, formatTemp } from './utils/formatters';
import { useCurrentWeather, useForecast, useHourlyForecast, useAccuracy, useAlerts, useFeedbackSummary } from './hooks/useWeatherConsensus';
import { useLocation } from './hooks/useLocation';

type ForecastView = 'daily' | 'hourly';

function conditionBgClass(conditionCode?: string): string {
  const code = conditionCode ?? 'unknown';
  const known = [
    'clear', 'partly_cloudy', 'cloudy', 'fog',
    'rain', 'drizzle', 'rain_showers',
    'snow', 'snow_showers', 'thunderstorm',
  ];
  return `wx-bg wx-${known.includes(code) ? code : 'unknown'}`;
}

export default function App() {
  const [city, setCity] = useState('Toronto');
  const [searchValue, setSearchValue] = useState('Toronto');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [showAccuracy, setShowAccuracy] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [forecastView, setForecastView] = useState<ForecastView>('daily');
  const [chatOpen, setChatOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: weather, isLoading, isError, error } = useCurrentWeather(city, coords);
  const { data: forecastData, isLoading: forecastLoading } = useForecast(city, coords);
  const { data: hourlyData } = useHourlyForecast(city, coords);
  const { data: accuracyData } = useAccuracy(city);
  const { data: alertsData } = useAlerts(city, coords);
  const { data: feedbackSummary } = useFeedbackSummary(city);

  const { locate, loading: locating, error: geoError } = useLocation(newCity => {
    setCity(newCity);
    setSearchValue(newCity);
    setCoords(null);
  });

  const conditionCode = weather?.consensus.sources[0]?.conditionCode;
  const mainIcon = conditionCodeToEmoji(conditionCode ?? 'unknown');

  return (
    <>
      {/* Animated background */}
      <div className={conditionBgClass(conditionCode)} aria-hidden="true" />

      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-30 bg-black/25 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
          <span className="text-white font-bold text-lg tracking-tight shrink-0">WeatherWise</span>

          <div className="flex-1 min-w-0">
            <SearchBar
              value={searchValue}
              onValueChange={setSearchValue}
              onSearch={(cityLabel, c) => { setCity(cityLabel); setCoords(c ?? null); }}
              onLocate={locate}
              locating={locating}
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">
              {(['C', 'F'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    unit === u ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  °{u}
                </button>
              ))}
            </div>

            {weather && (
              <>
                <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">
                  {(['daily', 'hourly'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setForecastView(v)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                        forecastView === v ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowAccuracy(v => !v)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                    showAccuracy ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50 hover:text-white/80'
                  }`}
                >
                  Scorecard
                  {accuracyData?.usingDynamicWeights && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" title="Dynamic weights active" />
                  )}
                </button>

                <ShareCard consensus={weather.consensus} city={city} unit={unit} />
              </>
            )}
          </div>
        </div>
        {geoError && (
          <p className="text-center text-amber-400/80 text-xs pb-1">{geoError}</p>
        )}
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <div className="max-w-[1400px] mx-auto px-4 pt-4 pb-20">

        {isLoading && (
          <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-12 text-center">
            <div className="animate-pulse text-4xl mb-3">🌤️</div>
            <p className="text-white/60 text-sm">Fetching forecasts from multiple sources…</p>
          </div>
        )}

        {isError && (
          <div className="rounded-2xl bg-red-500/10 border border-red-400/30 p-6 text-center">
            <p className="text-red-300 font-medium">Failed to fetch weather</p>
            <p className="text-red-400/70 text-sm mt-1">
              {(error as Error)?.message ?? 'Check your connection or try another city.'}
            </p>
          </div>
        )}

        {weather && !isLoading && (
          <div className="space-y-3">

            {alertsData && alertsData.alerts.length > 0 && (
              <AlertsBanner alerts={alertsData.alerts} />
            )}

            <SmartSummary
              consensus={weather.consensus}
              forecast={forecastData?.forecast}
            />

            {/* ═══ HERO ROW ═══ */}
            <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                {/* Left: Temp + icon + city */}
                <div className="flex items-center gap-4">
                  <span className="text-6xl leading-none shrink-0" role="img" aria-label={weather.consensus.condition}>
                    {mainIcon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-5xl font-light tracking-tight text-white leading-none">
                      {formatTemp(weather.consensus.temperature, unit)}
                    </div>
                    <div className="text-white/70 text-base mt-1 truncate">{weather.consensus.condition}</div>
                    <div className="text-white/50 text-sm mt-1.5 flex items-center gap-1 flex-wrap">
                      <span>📍</span>
                      <span className="truncate">{weather.location}</span>
                      <span className="text-white/25">·</span>
                      <span className="text-white/35 text-xs shrink-0">
                        {weather.sources.length} source{weather.sources.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-white/25 text-xs mt-0.5">
                      {new Date(weather.updatedAt).toLocaleTimeString()}
                      {weather.cached && ' · cached'}
                      {accuracyData?.usingDynamicWeights && ' · dynamic weights'}
                    </div>
                  </div>
                </div>

                {/* Center: Source agreement */}
                <div className="flex flex-col justify-center gap-3 md:border-x md:border-white/10 md:px-5 border-t border-white/10 pt-4 md:border-t-0 md:pt-0">
                  <ConfidenceBar score={weather.consensus.confidenceScore} />
                  {weather.consensus.isDisputed ? (
                    <DisputeBadge spread={weather.consensus.spread} message={weather.consensus.disputeMessage} />
                  ) : (
                    <p className="text-sm text-emerald-400/80 flex items-center gap-2">
                      <span>✓</span>
                      {weather.consensus.disputeMessage}
                    </p>
                  )}
                </div>

                {/* Right: 4-stat mini grid */}
                <div className="border-t border-white/10 pt-4 md:border-t-0 md:pt-0">
                  <DetailsPanel consensus={weather.consensus} unit={unit} mode="hero" hourly={hourlyData?.hours} />
                </div>

              </div>
            </div>

            {/* ═══ 2-COLUMN GRID ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-3">

              {/* Left column (60%) */}
              <div className="space-y-3">
                {forecastView === 'daily' && (
                  <>
                    {forecastData && !forecastLoading && (
                      <ForecastChart forecast={forecastData.forecast} unit={unit} />
                    )}
                    {forecastLoading && <ForecastSkeleton label="7-day forecast" />}
                  </>
                )}
                {forecastView === 'hourly' && hourlyData && (
                  <HourlyChart hours={hourlyData.hours} unit={unit} />
                )}
                <SourceBreakdown
                  sources={weather.sources}
                  consensus={weather.consensus}
                  accuracy={accuracyData?.sources ?? []}
                  unit={unit}
                />
              </div>

              {/* Right column (40%) */}
              <div className="space-y-3">
                {hourlyData && hourlyData.hours.length > 0 && (
                  <BestTimeWidget hours={hourlyData.hours} />
                )}

                {showAccuracy && accuracyData && (
                  <AccuracyLeaderboard accuracy={accuracyData} />
                )}

                {weather.consensus.airQualityIndex != null && weather.consensus.airQualityCategory && (
                  <AirQuality
                    aqi={weather.consensus.airQualityIndex}
                    category={weather.consensus.airQualityCategory}
                  />
                )}
              </div>
            </div>

            {/* ═══ BOTTOM STRIP ═══ */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden">
              <button
                onClick={() => setDetailsOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-white/50 hover:text-white/70 transition-colors"
              >
                <span className="text-sm font-medium">More details</span>
                <span className="text-xs text-white/30">{detailsOpen ? '▲ Collapse' : '▼ Expand'}</span>
              </button>

              {detailsOpen && (
                <div className="px-5 pb-5 space-y-4 border-t border-white/8 pt-4">
                  <DetailsPanel consensus={weather.consensus} unit={unit} mode="details" hourly={hourlyData?.hours} />

                  {weather.consensus.sunriseTime && weather.consensus.sunsetTime && (
                    <SunArc
                      sunriseTime={weather.consensus.sunriseTime}
                      sunsetTime={weather.consensus.sunsetTime}
                      moonPhase={weather.consensus.moonPhase}
                    />
                  )}

                  <NotificationOptIn consensus={weather.consensus} city={city} />

                  <LocationFeedback city={city} coords={coords} summary={feedbackSummary} />
                </div>
              )}
            </div>

          </div>
        )}

        {!weather && !isLoading && !isError && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="text-5xl mb-3">🌍</div>
              <p className="text-white/80 font-semibold text-lg">Enter a city to get started</p>
              <p className="text-white/40 text-sm max-w-sm mx-auto">
                WeatherWise pulls from multiple forecast sources and shows you how much they agree — so you know when to trust the forecast.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { icon: '📊', title: 'Source Scorecard', desc: 'See which service is actually accurate in your city, tracked over time.' },
                { icon: '🤝', title: 'Consensus Engine', desc: 'When sources agree, confidence is high. When they split, we flag it.' },
                { icon: '🎯', title: 'Honest Forecasts', desc: 'Days 1–3 show precise temps. Day 7+ shows only a trend — because precision there is fiction.' },
                { icon: '🤖', title: 'Ask AI', desc: 'Ask "Should I run today?" and get a plain-English answer grounded in real data.' },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3">
                  <span className="text-xl shrink-0">{f.icon}</span>
                  <div>
                    <p className="text-white/70 font-medium">{f.title}</p>
                    <p className="text-white/35 text-xs mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* AI Chat FAB */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-5 py-3 shadow-lg text-sm font-medium transition-colors z-40"
      >
        Ask AI
      </button>

      <AIChatDrawer
        city={city}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
}

function ForecastSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-center text-white/40 text-sm animate-pulse">
      Loading {label}…
    </div>
  );
}
