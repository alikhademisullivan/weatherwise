import { useState, useRef, useEffect, useCallback } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
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
import SavedLocations from './components/SavedLocations';
import HistoricalComparison from './components/HistoricalComparison';
import PrecipTimeline from './components/PrecipTimeline';
import WeekendPlanner from './components/WeekendPlanner';
import CommuteMode from './components/CommuteMode';
import CustomAlerts from './components/CustomAlerts';
import DigestSubscribe from './components/DigestSubscribe';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBanner from './components/OfflineBanner';
import AboutPage from './components/AboutPage';
import NotFoundPage from './components/NotFoundPage';
import RadarPage from './components/RadarPage';
import BottomNav from './components/BottomNav';
import FeedbackWidget from './components/FeedbackWidget';
import WelcomeScreen from './components/WelcomeScreen';
import { AuthButton } from './components/AuthButton';
import { conditionCodeToEmoji, formatTemp } from './utils/formatters';
import {
  useCurrentWeather,
  useForecast,
  useHourlyForecast,
  useExtendedHourly,
  useAccuracy,
  useAlerts,
  useFeedbackSummary,
  useHistorical,
  usePrecipTimeline,
} from './hooks/useWeatherConsensus';
import { useLocation } from './hooks/useLocation';
import { useSavedLocations } from './hooks/useSavedLocations';

type ForecastView = 'daily' | 'hourly' | 'weekend';
type Theme = 'dark' | 'light';

function conditionBgClass(conditionCode?: string): string {
  const code = conditionCode ?? 'unknown';
  const known = [
    'clear', 'partly_cloudy', 'cloudy', 'fog',
    'rain', 'drizzle', 'rain_showers',
    'snow', 'snow_showers', 'thunderstorm',
  ];
  return `wx-bg wx-${known.includes(code) ? code : 'unknown'}`;
}

// Read URL params on startup for ?city= / ?lat=&lon= deep-link support
function readUrlParams(): { city: string; lat?: number; lon?: number } | null {
  const params = new URLSearchParams(window.location.search);
  const city = params.get('city');
  const latStr = params.get('lat');
  const lonStr = params.get('lon');
  if (!city) return null;
  const lat = latStr ? parseFloat(latStr) : undefined;
  const lon = lonStr ? parseFloat(lonStr) : undefined;
  return { city, lat: isNaN(lat as number) ? undefined : lat, lon: isNaN(lon as number) ? undefined : lon };
}

export default function App() {
  const urlParams = readUrlParams();
  const lastCity = urlParams?.city ?? localStorage.getItem('ww_last_city') ?? '';

  const [showWelcome, setShowWelcome] = useState(!lastCity);
  const [city, setCity] = useState(lastCity);
  const [searchValue, setSearchValue] = useState(lastCity);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    urlParams?.lat !== undefined && urlParams?.lon !== undefined
      ? { lat: urlParams.lat, lon: urlParams.lon }
      : null,
  );
  const [showAccuracy, setShowAccuracy] = useState(false);
  // G1.1: persist unit across sessions
  const [unit, setUnit] = useState<'C' | 'F'>(
    () => (localStorage.getItem('ww-unit') as 'C' | 'F') ?? 'C',
  );
  const [forecastView, setForecastView] = useState<ForecastView>('daily');
  const [forecastDays, setForecastDays] = useState<7 | 14>(7);
  const [chatOpen, setChatOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('ww-theme') as Theme) ?? 'dark'
  );
  const [isOffline, setIsOffline] = useState(
    () => new URLSearchParams(window.location.search).get('offline') === 'true' || !navigator.onLine
  );
  // G4.27: compact view — secondary stats hidden until user expands
  const [showMore, setShowMore] = useState(false);
  // G4.28: CommuteMode collapsed by default
  const [commuteOpen, setCommuteOpen] = useState(false);

  const scorecardRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { locations: savedLocations, save: saveLocation, remove: removeLocation, isSaved } = useSavedLocations();

  const { data: weather, isLoading, isError, error } = useCurrentWeather(city, coords);
  const { data: forecastData, isLoading: forecastLoading } = useForecast(city, coords, forecastDays);
  const { data: hourlyData } = useHourlyForecast(city, coords);
  const { data: extendedHourly } = useExtendedHourly(city, coords, 7);
  const { data: accuracyData } = useAccuracy(city);
  const { data: alertsData } = useAlerts(city, coords);
  const { data: feedbackSummary } = useFeedbackSummary(city);
  const { data: historicalData } = useHistorical(city, coords);
  const { data: precipTimeline } = usePrecipTimeline(city, coords);

  const { locate, loading: locating, error: geoError } = useLocation(newCity => {
    setCity(newCity);
    setSearchValue(newCity);
    setCoords(null);
    setShowWelcome(false);
  });

  // G1.1: save unit preference
  const changeUnit = useCallback((u: 'C' | 'F') => {
    setUnit(u);
    localStorage.setItem('ww-unit', u);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'light') html.classList.add('light');
    else html.classList.remove('light');
    localStorage.setItem('ww-theme', theme);
  }, [theme]);

  useEffect(() => {
    const setOnline = () => setIsOffline(false);
    const setOffline = () => setIsOffline(true);
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  useEffect(() => {
    if (weather && city) {
      localStorage.setItem('ww_last_city', weather.location ?? city);
      localStorage.setItem('ww_last_updated', new Date().toISOString());
    }
  }, [weather, city]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // G4.29: scroll scorecard into view when toggled on
  const handleScorecardToggle = () => {
    const next = !showAccuracy;
    setShowAccuracy(next);
    if (next) {
      setTimeout(() => {
        scorecardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  const conditionCode = weather?.consensus.sources[0]?.conditionCode;
  const mainIcon = conditionCodeToEmoji(conditionCode ?? 'unknown');

  // G4.30: stagger index helper
  const fadeClass = (_idx: number) =>
    `animate-fadeIn opacity-0 [animation-fill-mode:forwards]`;
  const fadeStyle = (idx: number): React.CSSProperties => ({
    animationDelay: `${idx * 60}ms`,
    animationDuration: '300ms',
  });

  return (
    <>
      <div className={conditionBgClass(conditionCode)} aria-hidden="true" />

      <Routes>
        <Route path="/about" element={<AboutPage />} />
        <Route path="/radar" element={<RadarPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/*" element={<>

      {showWelcome && (
        <WelcomeScreen
          onLocate={locate}
          locating={locating}
          geoError={geoError ?? undefined}
          onSearch={(cityLabel, c) => {
            setCity(cityLabel);
            setSearchValue(cityLabel);
            setCoords(c ?? null);
            setShowWelcome(false);
          }}
        />
      )}

      {!showWelcome && <>

      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-30 bg-black/25 backdrop-blur-md border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
          <Link to="/" className="text-white font-bold text-base sm:text-lg tracking-tight shrink-0 hover:text-white/80 transition-colors">
            <span className="hidden sm:inline">WeatherWise</span>
            <span className="sm:hidden">WW</span>
          </Link>

          <div className="flex-1 min-w-0">
            <SearchBar
              value={searchValue}
              onValueChange={setSearchValue}
              onSearch={(cityLabel, c) => { setCity(cityLabel); setCoords(c ?? null); }}
              onLocate={locate}
              locating={locating}
              inputRef={searchInputRef}
            />
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* °C / °F toggle */}
            <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">
              {(['C', 'F'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => changeUnit(u)}
                  className={`px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    unit === u ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  °{u}
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="text-xs px-2 sm:px-2.5 py-1 rounded-lg bg-white/10 text-white/50 hover:text-white/80 hover:bg-white/15 transition-colors"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Desktop-only controls */}
            <div className="hidden sm:flex items-center gap-1.5">
              <Link
                to="/about"
                className="text-xs px-2.5 py-1 rounded-lg text-white/50 hover:text-white/80 transition-colors"
              >
                About
              </Link>

              <AuthButton />

              {weather && (
                <>
                  <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">
                    {(['daily', 'hourly', 'weekend'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setForecastView(v)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                          forecastView === v ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                        }`}
                      >
                        {v === 'weekend' ? '📅' : v}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleScorecardToggle}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                      showAccuracy ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50 hover:text-white/80'
                    }`}
                  >
                    Scorecard
                    {accuracyData?.usingDynamicWeights && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" title="Dynamic weights active" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (isSaved(city)) {
                        removeLocation(city);
                      } else {
                        saveLocation({ label: searchValue, city, lat: coords?.lat ?? null, lon: coords?.lon ?? null });
                      }
                    }}
                    title={isSaved(city) ? 'Remove from saved' : 'Save this location'}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      isSaved(city)
                        ? 'bg-blue-500/25 text-blue-300 hover:bg-red-500/20 hover:text-red-300'
                        : 'bg-white/10 text-white/50 hover:text-white/80'
                    }`}
                  >
                    {isSaved(city) ? '★' : '☆'}
                  </button>

                  <ShareCard consensus={weather.consensus} city={city} unit={unit} coords={coords ?? undefined} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile sub-toolbar */}
        {weather && (
          <div className="sm:hidden px-3 pb-2 flex items-center gap-2">
            <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">
              {(['daily', 'hourly', 'weekend'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setForecastView(v)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                    forecastView === v ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {v === 'weekend' ? '📅' : v}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (isSaved(city)) {
                  removeLocation(city);
                } else {
                  saveLocation({ label: searchValue, city, lat: coords?.lat ?? null, lon: coords?.lon ?? null });
                }
              }}
              title={isSaved(city) ? 'Remove from saved' : 'Save this location'}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                isSaved(city)
                  ? 'bg-blue-500/25 text-blue-300 hover:bg-red-500/20 hover:text-red-300'
                  : 'bg-white/10 text-white/50 hover:text-white/80'
              }`}
            >
              {isSaved(city) ? '★ Saved' : '☆ Save'}
            </button>

            <div className="ml-auto">
              <AuthButton />
            </div>
          </div>
        )}
        {geoError && (
          <p className="text-center text-amber-400/80 text-xs pb-1">{geoError}</p>
        )}
        <SavedLocations
          locations={savedLocations}
          activeCity={city}
          onSelect={loc => {
            setCity(loc.city);
            setSearchValue(loc.label);
            setCoords(loc.lat !== null && loc.lon !== null ? { lat: loc.lat, lon: loc.lon } : null);
          }}
          onRemove={removeLocation}
        />
      </header>

      <OfflineBanner isOffline={isOffline} />

      {/* ─── MAIN CONTENT ─── */}
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-36 sm:pb-24">

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
              <div style={fadeStyle(0)} className={fadeClass(0)}>
                <AlertsBanner alerts={alertsData.alerts} />
              </div>
            )}

            {/* G4.25: SmartSummary at higher contrast */}
            <div style={fadeStyle(1)} className={fadeClass(1)}>
              <SmartSummary
                consensus={weather.consensus}
                forecast={forecastData?.forecast}
                unit={unit}
              />
            </div>

            {/* ═══ HERO ROW ═══ */}
            <div style={fadeStyle(2)} className={`${fadeClass(2)} rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-5`}>
              {/* G4.26: On mobile, confidence/dispute section comes FIRST (before stats) via order classes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                {/* Left: Temp + icon */}
                <div className="flex items-center gap-4">
                  <span className="text-6xl leading-none shrink-0" role="img" aria-label={weather.consensus.condition}>
                    {mainIcon}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-5xl font-light tracking-tight text-white leading-none">
                        {formatTemp(weather.consensus.temperature, unit)}
                      </span>
                      <span className="text-xl text-white/50 font-light leading-none" title="Feels like">
                        Feels {formatTemp(weather.consensus.feelsLike, unit)}
                      </span>
                    </div>
                    <div className="text-white/70 text-base mt-1 truncate">{weather.consensus.condition}</div>
                    <div className="text-white/50 text-sm mt-1.5 flex items-center gap-1 flex-wrap">
                      <span>📍</span>
                      <span className="truncate">{weather.location}</span>
                      <span className="text-white/25">·</span>
                      <span className="text-white/40 text-xs shrink-0">
                        {weather.sources.length} source{weather.sources.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-white/40 text-xs mt-0.5">
                      {new Date(weather.updatedAt).toLocaleTimeString()}
                      {weather.cached && ' · cached'}
                      {accuracyData?.usingDynamicWeights && ' · dynamic weights'}
                    </div>
                  </div>
                </div>

                {/* Center: Source agreement — ORDER-FIRST on mobile so it's seen before the stats grid */}
                <div className="flex flex-col justify-center gap-3 md:border-x md:border-white/10 md:px-5 border-t border-white/10 pt-4 md:border-t-0 md:pt-0 order-first md:order-none">
                  <ConfidenceBar score={weather.consensus.confidenceScore} />
                  {weather.consensus.isDisputed ? (
                    <DisputeBadge
                      spread={weather.consensus.spread}
                      message={weather.consensus.disputeMessage}
                      unit={unit}
                    />
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
                      <span className="text-emerald-400 text-lg leading-none">✓</span>
                      <div>
                        <p className="text-emerald-300 text-sm font-medium">Sources agree</p>
                        <p className="text-emerald-400/60 text-xs mt-0.5">{weather.consensus.disputeMessage}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: 4-stat mini grid */}
                <div className="border-t border-white/10 pt-4 md:border-t-0 md:pt-0">
                  <DetailsPanel consensus={weather.consensus} unit={unit} mode="hero" hourly={hourlyData?.hours} />
                </div>

              </div>
            </div>

            {/* G3.21: Notification opt-in — outside the collapsed section, surfaces after load */}
            <NotificationOptIn consensus={weather.consensus} city={city} />

            {/* G4.28: CommuteMode — collapsible by default */}
            {hourlyData && hourlyData.hours.length > 0 && (
              <div style={fadeStyle(3)} className={fadeClass(3)}>
                <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm overflow-hidden">
                  <button
                    onClick={() => setCommuteOpen(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-3 text-white/50 hover:text-white/70 transition-colors"
                  >
                    <span className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                      🚗 Commute Mode
                    </span>
                    <span className="text-xs text-white/30">{commuteOpen ? '▲ Collapse' : '▼ Expand'}</span>
                  </button>
                  {commuteOpen && (
                    <div className="border-t border-white/8">
                      <CommuteMode hours={hourlyData.hours} unit={unit} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ═══ 2-COLUMN GRID ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-3">

              {/* Left column (60%) */}
              <div className="space-y-3">
                {precipTimeline && precipTimeline.minutes.length > 0 && (
                  <ErrorBoundary>
                    <div style={fadeStyle(4)} className={fadeClass(4)}>
                      <PrecipTimeline data={precipTimeline} hours={extendedHourly?.hours} sources={weather.sources} />
                    </div>
                  </ErrorBoundary>
                )}

                {forecastView === 'daily' && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">Forecast range:</span>
                      <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">
                        {([7, 14] as const).map(d => (
                          <button
                            key={d}
                            onClick={() => setForecastDays(d)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              forecastDays === d ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                            }`}
                          >
                            {d}-day
                          </button>
                        ))}
                      </div>
                    </div>

                    {forecastData && !forecastLoading && (
                      <ErrorBoundary>
                        <div style={fadeStyle(5)} className={fadeClass(5)}>
                          <ForecastChart forecast={forecastData.forecast} unit={unit} days={forecastDays} />
                        </div>
                      </ErrorBoundary>
                    )}
                    {forecastLoading && <ForecastSkeleton label={`${forecastDays}-day forecast`} />}
                  </>
                )}

                {forecastView === 'hourly' && hourlyData && (
                  <HourlyChart hours={hourlyData.hours} unit={unit} />
                )}

                {forecastView === 'weekend' && forecastData && (
                  <ErrorBoundary>
                    <WeekendPlanner
                      forecast={forecastData.forecast}
                      hourly={extendedHourly?.hours ?? []}
                      unit={unit}
                    />
                  </ErrorBoundary>
                )}

                <ErrorBoundary>
                  <div style={fadeStyle(6)} className={fadeClass(6)}>
                    <SourceBreakdown
                      sources={weather.sources}
                      consensus={weather.consensus}
                      accuracy={accuracyData?.sources ?? []}
                      unit={unit}
                      onViewScorecard={() => {
                        setShowMore(true);
                        setShowAccuracy(true);
                        setTimeout(() => {
                          scorecardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }, 80);
                      }}
                    />
                  </div>
                </ErrorBoundary>
              </div>

              {/* Right column (40%) */}
              <div className="space-y-3">
                {hourlyData && hourlyData.hours.length > 0 && (
                  <ErrorBoundary>
                    <div style={fadeStyle(4)} className={fadeClass(4)}>
                      <BestTimeWidget hours={hourlyData.hours} unit={unit} />
                    </div>
                  </ErrorBoundary>
                )}

                {/* G4.27: Secondary stats hidden until "Show more" is clicked */}
                {showMore && (
                  <>
                    {historicalData && (
                      <ErrorBoundary>
                        <HistoricalComparison
                          data={historicalData}
                          todayHigh={forecastData?.forecast[0]?.high}
                          unit={unit}
                        />
                      </ErrorBoundary>
                    )}

                    {showAccuracy && accuracyData && (
                      <ErrorBoundary>
                        <div ref={scorecardRef}>
                          <AccuracyLeaderboard accuracy={accuracyData} />
                        </div>
                      </ErrorBoundary>
                    )}

                    {weather.consensus.airQualityIndex != null && weather.consensus.airQualityCategory && (
                      <ErrorBoundary>
                        <AirQuality
                          aqi={weather.consensus.airQualityIndex}
                          category={weather.consensus.airQualityCategory}
                        />
                      </ErrorBoundary>
                    )}
                  </>
                )}

                {!showMore && (
                  <button
                    onClick={() => setShowMore(true)}
                    className="w-full text-xs text-white/40 hover:text-white/70 py-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/8 transition-colors"
                  >
                    ▼ Show historical data, air quality &amp; accuracy
                  </button>
                )}

                {/* Scorecard when showMore is false but manually toggled */}
                {!showMore && showAccuracy && accuracyData && (
                  <ErrorBoundary>
                    <div ref={scorecardRef}>
                      <AccuracyLeaderboard accuracy={accuracyData} />
                    </div>
                  </ErrorBoundary>
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

                  <CustomAlerts consensus={weather.consensus} city={city} />

                  <LocationFeedback city={city} coords={coords} summary={feedbackSummary} />

                  <DigestSubscribe city={city} />
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
              <p className="text-white/50 text-sm max-w-sm mx-auto">
                WeatherWise pulls from multiple forecast sources and shows you how much they agree — so you know when to trust the forecast.
              </p>
              <p className="text-white/30 text-xs mt-2">Tip: Press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/40">/</kbd> to search</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { icon: '📊', title: 'Source Scorecard', desc: 'See which service is actually accurate in your city, tracked over time.' },
                { icon: '🤝', title: 'Multi-Source Forecast', desc: 'When sources agree, confidence is high. When they split, we flag it.' },
                { icon: '🎯', title: 'Honest Forecasts', desc: 'Days 1–3 show precise temps. Day 7+ shows only a trend — because precision there is fiction.' },
                { icon: '🤖', title: 'Ask AI', desc: 'Ask "Should I run today?" and get a plain-English answer grounded in real data.' },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-3">
                  <span className="text-xl shrink-0">{f.icon}</span>
                  <div>
                    <p className="text-white/70 font-medium">{f.title}</p>
                    <p className="text-white/45 text-xs mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <FeedbackWidget />

      <button
        onClick={() => setChatOpen(true)}
        className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2.5 sm:px-5 sm:py-3 shadow-lg text-sm font-medium transition-colors z-40"
        aria-label="Ask AI about today's weather"
      >
        Ask AI
      </button>

      <BottomNav city={city} coords={coords} />

      <ErrorBoundary>
        <AIChatDrawer
          city={city}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      </ErrorBoundary>
      </>}
      </>} />
      </Routes>
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
