import { useSearchParams } from 'react-router-dom';
import RadarMap from './RadarMap';
import BottomNav from './BottomNav';

export default function RadarPage() {
  const [params] = useSearchParams();
  const city = params.get('city') ?? localStorage.getItem('ww_last_city') ?? '';
  const lat  = params.get('lat')  ? parseFloat(params.get('lat')!)  : null;
  const lon  = params.get('lon')  ? parseFloat(params.get('lon')!)  : null;
  const coords = lat !== null && lon !== null ? { lat, lon } : null;

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      {/* Slim header */}
      <header className="shrink-0 z-30 bg-black/30 backdrop-blur-md border-b border-white/10 px-4 h-14 flex items-center gap-3">
        <span className="text-white font-bold text-lg tracking-tight shrink-0">WeatherWise</span>
        <span className="text-white/20">›</span>
        <span className="text-white/60 text-sm font-medium flex items-center gap-1.5">
          <span>📡</span> Radar
        </span>
        {city && (
          <span className="text-white/35 text-xs truncate hidden sm:block">· {city}</span>
        )}
      </header>

      {/* RadarMap fills space between header and bottom nav */}
      <div className="flex-1 overflow-hidden p-2 sm:p-3 pb-16">
        <RadarMap city={city} lat={lat} lon={lon} fullPage />
      </div>

      <BottomNav city={city} coords={coords} />
    </div>
  );
}
