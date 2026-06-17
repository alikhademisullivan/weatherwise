import { useEffect, useState } from 'react';

interface Props {
  isOffline: boolean;
}

export default function OfflineBanner({ isOffline }: Props) {
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
      setShowBackOnline(false);
    } else if (wasOffline) {
      setShowBackOnline(true);
      const t = setTimeout(() => {
        setShowBackOnline(false);
        setWasOffline(false);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [isOffline, wasOffline]);

  if (!isOffline && !showBackOnline) return null;

  if (showBackOnline) {
    return (
      <div
        role="status"
        className="w-full bg-emerald-500/15 border-b border-emerald-500/25 text-emerald-300 text-xs font-medium px-4 py-2 text-center"
      >
        Back online — refreshing…
      </div>
    );
  }

  const city = localStorage.getItem('ww_last_city') ?? 'your last location';
  const rawTs = localStorage.getItem('ww_last_updated');
  const timestamp = rawTs
    ? new Date(rawTs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  return (
    <div
      role="alert"
      className="w-full bg-amber-500/15 border-b border-amber-500/25 text-amber-300 text-xs font-medium px-4 py-2 text-center"
    >
      ⚡ You're offline — showing cached data for {city}
      {timestamp && <span className="text-amber-300/60"> as of {timestamp}</span>}
    </div>
  );
}
