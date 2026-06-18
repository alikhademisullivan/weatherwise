import { NavLink } from 'react-router-dom';

interface Props {
  city?: string;
  coords?: { lat: number; lon: number } | null;
}

export default function BottomNav({ city = '', coords }: Props) {
  const radarHref = `/radar?city=${encodeURIComponent(city)}${coords ? `&lat=${coords.lat}&lon=${coords.lon}` : ''}`;

  const base = 'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-xs font-medium transition-colors';
  const active = 'text-white';
  const inactive = 'text-white/40 hover:text-white/65';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-black/50 backdrop-blur-md border-t border-white/10 flex">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
      >
        {({ isActive }) => (
          <>
            <span className="text-xl leading-none">{isActive ? '🌤️' : '⛅'}</span>
            <span>Weather</span>
          </>
        )}
      </NavLink>

      <NavLink
        to={radarHref}
        className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
      >
        {({ isActive }) => (
          <>
            <span className="text-xl leading-none">📡</span>
            <span className={isActive ? '' : 'opacity-60'}>Radar</span>
          </>
        )}
      </NavLink>
    </nav>
  );
}
