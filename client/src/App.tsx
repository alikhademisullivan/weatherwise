import { useState } from 'react';
import SearchBar from './components/SearchBar';
import ConsensusCard from './components/ConsensusCard';
import WeatherStats from './components/WeatherStats';
import SourceBreakdown from './components/SourceBreakdown';
import ForecastChart from './components/ForecastChart';
import HourlyChart from './components/HourlyChart';
import { useCurrentWeather, useForecast, useHourlyForecast } from './hooks/useWeatherConsensus';
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
  const [showSources, setShowSources] = useState(false);
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [forecastView, setForecastView] = useState<ForecastView>('daily');

  const { data: weather, isLoading, isError, error } = useCurrentWeather(city);
  const { data: forecastData, isLoading: forecastLoading } = useForecast(city);
  const { data: hourlyData, isLoading: hourlyLoading } = useHourlyForecast(city);

  const { locate, loading: locating, error: geoError } = useLocation(newCity => {
    setCity(newCity);
  });

  const conditionCode = weather?.consensus.sources[0]?.conditionCode;

  return (
    <>
      {/* Animated background layer */}
      <div className={conditionBgClass(conditionCode)} aria-hidden="true" />

      <div className="min-h-screen px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold text-white tracking-tight">WeatherWise</h1>
            <p className="text-white/50 text-sm">The weather app that tells you when to trust the forecast</p>
          </div>

          {/* Search */}
          <SearchBar
            onSearch={setCity}
            onLocate={locate}
            locating={locating}
            initialValue={city}
          />

          {/* Geolocation error */}
          {geoError && (
            <p className="text-center text-amber-400/80 text-xs">{geoError}</p>
          )}

          {/* Controls row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* °C / °F */}
            <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
              {(['C', 'F'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    unit === u ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  °{u}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Forecast view toggle */}
              {weather && (
                <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
                  {(['daily', 'hourly'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setForecastView(v)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                        forecastView === v ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}

              {/* Source breakdown toggle */}
              {weather && (
                <button
                  onClick={() => setShowSources(v => !v)}
                  className="text-xs text-white/50 hover:text-white/80 transition-colors flex items-center gap-1"
                >
                  {showSources ? 'Hide' : 'Show'} sources
                  <span className="text-white/30">{showSources ? '▲' : '▼'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-12 text-center">
              <div className="animate-pulse text-4xl mb-3">🌤️</div>
              <p className="text-white/60 text-sm">Fetching forecasts from multiple sources…</p>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="rounded-2xl bg-red-500/10 border border-red-400/30 p-6 text-center">
              <p className="text-red-300 font-medium">Failed to fetch weather</p>
              <p className="text-red-400/70 text-sm mt-1">
                {(error as Error)?.message ?? 'Check your connection or try another city.'}
              </p>
            </div>
          )}

          {/* Main content */}
          {weather && !isLoading && (
            <>
              <ConsensusCard consensus={weather.consensus} location={weather.location} unit={unit} />

              <WeatherStats consensus={weather.consensus} unit={unit} />

              {showSources && (
                <SourceBreakdown sources={weather.sources} consensus={weather.consensus} unit={unit} />
              )}

              {/* Forecast section */}
              {forecastView === 'daily' && (
                <>
                  {forecastData && !forecastLoading && (
                    <ForecastChart forecast={forecastData.forecast} unit={unit} />
                  )}
                  {forecastLoading && <ForecastSkeleton label="7-day forecast" />}
                </>
              )}

              {forecastView === 'hourly' && (
                <>
                  {hourlyData && !hourlyLoading && (
                    <HourlyChart hours={hourlyData.hours} unit={unit} />
                  )}
                  {hourlyLoading && <ForecastSkeleton label="hourly forecast" />}
                </>
              )}

              {/* Footer meta */}
              <p className="text-center text-white/30 text-xs pb-4">
                Last updated: {new Date(weather.updatedAt).toLocaleTimeString()}
                {weather.cached && ' · cached'}
                {' · '}{weather.sources.length} source{weather.sources.length !== 1 ? 's' : ''}
              </p>
            </>
          )}

          {/* Empty state */}
          {!weather && !isLoading && !isError && (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
              <div className="text-5xl mb-3">🌍</div>
              <p className="text-white/50">Search for a city to get started</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ForecastSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-center text-white/40 text-sm animate-pulse">
      Loading {label}…
    </div>
  );
}
