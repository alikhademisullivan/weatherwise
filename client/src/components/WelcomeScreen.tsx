import { useRef, useState } from 'react';
import SearchBar from './SearchBar';

interface Props {
  onLocate: () => void;
  onSearch: (city: string, coords?: { lat: number; lon: number }) => void;
  locating: boolean;
  geoError?: string;
}

export default function WelcomeScreen({ onLocate, onSearch, locating, geoError }: Props) {
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative">
      {/* Branding */}
      <div className="text-center mb-10">
        <div className="text-7xl mb-5 select-none">🌤️</div>
        <h1 className="text-4xl font-bold text-white tracking-tight">WeatherWise</h1>
        <p className="text-white/50 text-base mt-2">
          Honest forecasts from multiple sources — so you know when to trust them.
        </p>
      </div>

      {/* Location options */}
      <div className="w-full max-w-md space-y-4">
        <button
          onClick={onLocate}
          disabled={locating}
          className="w-full py-3.5 rounded-xl bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
        >
          {locating ? (
            <>
              <span className="inline-block animate-spin text-base">↻</span>
              Detecting your location…
            </>
          ) : (
            <>
              <span className="text-base">📍</span>
              Use my location
            </>
          )}
        </button>

        {geoError && (
          <p className="text-amber-400/80 text-xs text-center">{geoError}</p>
        )}

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs font-medium">or search</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <SearchBar
          value={searchValue}
          onValueChange={setSearchValue}
          onSearch={onSearch}
          onLocate={onLocate}
          locating={locating}
          inputRef={inputRef}
        />
      </div>

      {/* Feature tiles */}
      <div className="grid grid-cols-2 gap-3 mt-12 w-full max-w-md">
        {[
          { icon: '📊', title: 'Source Scorecard', desc: 'Track which service is most accurate in your city.' },
          { icon: '🤝', title: 'Consensus Engine', desc: 'See when forecasters agree — or when they split.' },
          { icon: '🎯', title: 'Honest Forecasts', desc: 'Precision only where the data actually supports it.' },
          { icon: '🤖', title: 'Ask AI', desc: 'Plain-English answers grounded in real forecast data.' },
        ].map(f => (
          <div key={f.title} className="bg-white/5 border border-white/8 rounded-xl p-4">
            <span className="text-2xl">{f.icon}</span>
            <p className="text-white/75 font-semibold text-xs mt-2">{f.title}</p>
            <p className="text-white/35 text-[11px] mt-1 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
