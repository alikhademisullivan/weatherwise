import { useState } from 'react';
import type { WeatherAlert } from '../types/weather';

interface Props {
  alerts: WeatherAlert[];
}

const SEVERITY_STYLES: Record<WeatherAlert['severity'], { bg: string; border: string; badge: string; text: string; icon: string }> = {
  Minor:    { bg: 'bg-yellow-500/10',  border: 'border-yellow-400/30',  badge: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',  text: 'text-yellow-200', icon: '⚠️' },
  Moderate: { bg: 'bg-orange-500/10', border: 'border-orange-400/30', badge: 'bg-orange-400/20 text-orange-300 border-orange-400/30', text: 'text-orange-200', icon: '🔶' },
  Severe:   { bg: 'bg-red-500/10',    border: 'border-red-400/30',    badge: 'bg-red-400/20 text-red-300 border-red-400/30',    text: 'text-red-200',    icon: '🔴' },
  Extreme:  { bg: 'bg-red-900/20',    border: 'border-red-500/50',    badge: 'bg-red-500/30 text-red-200 border-red-500/50',    text: 'text-red-100',    icon: '🚨' },
};

function AlertCard({ alert, onDismiss }: { alert: WeatherAlert; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const s = SEVERITY_STYLES[alert.severity];

  return (
    <div className={`rounded-xl ${s.bg} border ${s.border} p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded border ${s.badge}`}>{alert.severity}</span>
            <span className={`font-semibold text-sm ${s.text}`}>{alert.event}</span>
          </div>
          <p className={`text-xs ${s.text} opacity-80 leading-relaxed`}>{alert.headline}</p>
          {alert.description && (
            <>
              {expanded && (
                <p className={`text-xs ${s.text} opacity-60 mt-2 leading-relaxed`}>{alert.description}</p>
              )}
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-xs text-white/40 hover:text-white/70 mt-1 transition-colors"
              >
                {expanded ? 'Show less ▲' : 'Show more ▼'}
              </button>
            </>
          )}
          {(alert.effective || alert.expires) && (
            <p className="text-xs text-white/30 mt-1">
              {alert.effective && `From ${new Date(alert.effective).toLocaleString()}`}
              {alert.effective && alert.expires && ' · '}
              {alert.expires && `Until ${new Date(alert.expires).toLocaleString()}`}
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-white/30 hover:text-white/70 text-sm transition-colors shrink-0"
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function alertKey(alert: WeatherAlert, index: number): string {
  return `${index}::${alert.event}::${alert.effective ?? ''}`;
}

export default function AlertsBanner({ alerts }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts
    .map((a, i) => ({ alert: a, key: alertKey(a, i) }))
    .filter(({ key }) => !dismissed.has(key));

  if (!visible.length) return null;

  return (
    <div className="space-y-2">
      {visible.map(({ alert, key }) => (
        <AlertCard
          key={key}
          alert={alert}
          onDismiss={() => setDismissed(prev => new Set(prev).add(key))}
        />
      ))}
    </div>
  );
}
