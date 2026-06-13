import { useState, useEffect, useRef } from 'react';
import type { ConsensusReading } from '../types/weather';

interface Props {
  consensus: ConsensusReading | undefined;
  city: string;
}

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function getPermissionState(): PermissionState {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as PermissionState;
}

function fireNotification(title: string, body: string) {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.ico' });
}

export default function NotificationOptIn({ consensus, city }: Props) {
  const [permission, setPermission] = useState<PermissionState>(getPermissionState);
  const [dismissed, setDismissed] = useState(false);
  const prevCityRef = useRef<string>('');
  const notifiedConditionsRef = useRef<Set<string>>(new Set());

  // Fire relevant notifications when consensus data arrives
  useEffect(() => {
    if (!consensus || permission !== 'granted') return;

    const cityChanged = prevCityRef.current !== city;
    if (cityChanged) {
      // Reset seen notifications when city changes
      notifiedConditionsRef.current.clear();
      prevCityRef.current = city;
    }

    const precip = consensus.precipitationProbability;
    const confidence = consensus.confidenceScore;

    // High-confidence rain alert: sources agree, rain very likely
    const rainKey = `rain-${city}-${Math.floor(precip / 10)}`;
    if (precip >= 70 && confidence >= 70 && !notifiedConditionsRef.current.has(rainKey)) {
      notifiedConditionsRef.current.add(rainKey);
      fireNotification(
        `WeatherWise: Rain likely in ${city}`,
        `${precip}% rain probability — ${consensus.sources.length} sources agree (${confidence}/100 confidence)`
      );
    }

    // Disputed forecast alert: sources strongly disagree
    const disputeKey = `dispute-${city}`;
    if (consensus.isDisputed && !notifiedConditionsRef.current.has(disputeKey)) {
      notifiedConditionsRef.current.add(disputeKey);
      fireNotification(
        `WeatherWise: Forecasts split for ${city}`,
        `Sources disagree by ${consensus.spread.toFixed(1)}°C — check back later for a clearer picture`
      );
    }
  }, [consensus, city, permission]);

  async function requestPermission() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
  }

  // Don't render if unsupported, already granted, or dismissed
  if (permission === 'unsupported' || permission === 'granted' || permission === 'denied' || dismissed) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-blue-500/10 border border-blue-400/20 px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">🔔</span>
        <p className="text-blue-200/80 text-xs">
          Get notified when sources agree about rain — or strongly disagree about tomorrow
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={requestPermission}
          className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          Enable
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/25 hover:text-white/50 text-sm transition-colors leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
