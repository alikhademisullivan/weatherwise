import { dayLength } from '../utils/formatters';

interface Props {
  sunriseTime: string;
  sunsetTime: string;
  moonPhase?: string;
}

function parseTimeStr(s: string): Date | null {
  const d = new Date(`1970-01-01 ${s}`);
  return isNaN(d.getTime()) ? null : d;
}

export default function SunArc({ sunriseTime, sunsetTime, moonPhase }: Props) {
  const rise = parseTimeStr(sunriseTime);
  const set = parseTimeStr(sunsetTime);
  if (!rise || !set) return null;

  const now = new Date();
  const nowProxy = new Date(`1970-01-01 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`);

  // 0–1 position of sun along the arc
  const total = set.getTime() - rise.getTime();
  const elapsed = nowProxy.getTime() - rise.getTime();
  const pos = Math.max(0, Math.min(1, total > 0 ? elapsed / total : 0));
  const isDaytime = pos >= 0 && pos <= 1 && elapsed >= 0;

  // SVG semi-circle: center (100, 80), radius 70
  const cx = 100;
  const cy = 80;
  const r = 70;

  // angle 0 = left (sunrise), π = right (sunset), sun travels clockwise top arc
  function arcPoint(t: number) {
    const angle = Math.PI - t * Math.PI; // π → 0
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle),
    };
  }

  const sunPt = arcPoint(pos);

  // Golden hour bands: 30 min = 30/(total/60000) fraction of arc
  const goldenFrac = Math.min(0.15, total > 0 ? (30 * 60000) / total : 0.1);

  function arcD(t0: number, t1: number) {
    const p0 = arcPoint(t0);
    const p1 = arcPoint(t1);
    const large = t1 - t0 > 0.5 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 0 ${p1.x} ${p1.y}`;
  }

  const dl = dayLength(sunriseTime, sunsetTime);

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm p-6">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Sun & Sky</h2>

      <svg viewBox="0 0 200 95" className="w-full max-w-xs mx-auto block" aria-label="Sun arc">
        {/* Horizon line */}
        <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {/* Full arc (dim) */}
        <path d={arcD(0, 1)} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />

        {/* Golden hour bands */}
        <path d={arcD(0, goldenFrac)} fill="none" stroke="rgba(251,191,36,0.5)" strokeWidth="4" strokeLinecap="round" />
        <path d={arcD(1 - goldenFrac, 1)} fill="none" stroke="rgba(251,146,60,0.5)" strokeWidth="4" strokeLinecap="round" />

        {/* Elapsed arc */}
        {isDaytime && pos > 0 && (
          <path d={arcD(0, pos)} fill="none" stroke="rgba(253,224,71,0.7)" strokeWidth="2" />
        )}

        {/* Sun dot */}
        {isDaytime ? (
          <circle cx={sunPt.x} cy={sunPt.y} r="6" fill="#fde047" className="drop-shadow-lg">
            <animate attributeName="r" values="5.5;6.5;5.5" dur="3s" repeatCount="indefinite" />
          </circle>
        ) : (
          // Night: show moon at the appropriate end
          <text x={elapsed < 0 ? cx - r - 4 : cx + r + 4} y={cy + 4} fontSize="12" textAnchor="middle">🌙</text>
        )}

        {/* Sunrise label */}
        <text x={cx - r} y={cy + 14} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">{sunriseTime}</text>
        {/* Sunset label */}
        <text x={cx + r} y={cy + 14} fontSize="8" fill="rgba(255,255,255,0.5)" textAnchor="middle">{sunsetTime}</text>
      </svg>

      <div className="text-center mt-2 space-y-1">
        {dl && <p className="text-white/50 text-xs">{dl}</p>}
        {moonPhase && (
          <p className="text-white/40 text-xs">🌙 {moonPhase}</p>
        )}
      </div>
    </div>
  );
}
