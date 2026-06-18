import { useRef, useEffect, useState } from 'react';
import { dayLength } from '../utils/formatters';

interface Props {
  sunriseTime: string;
  sunsetTime: string;
  moonPhase?: string;
}

function toMinutes(s: string): number {
  const clean = s.trim();
  const ampm = /([ap]m)/i.exec(clean);
  const parts = clean.replace(/\s*(am|pm)/i, '').split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] ?? '0', 10);
  if (ampm) {
    const period = ampm[1].toLowerCase();
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
  }
  return h * 60 + m;
}

// Arc endpoints sit at y=90 inside a 400×120 viewBox.
// Control point at (200,15) gives a tall, full-height curve.
const P0 = { x: 20,  y: 90 };
const P1 = { x: 200, y: 15 };
const P2 = { x: 380, y: 90 };
const ARC_D = `M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`;

function bezier(t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x,
    y: mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y,
  };
}

export default function SunArc({ sunriseTime, sunsetTime, moonPhase }: Props) {
  const pathRef = useRef<SVGPathElement>(null);
  const [totalLength, setTotalLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) setTotalLength(pathRef.current.getTotalLength());
  }, []);

  const sunriseMin = toMinutes(sunriseTime);
  const sunsetMin  = toMinutes(sunsetTime);
  const now        = new Date();
  const nowMin     = now.getHours() * 60 + now.getMinutes();

  const daySpan     = sunsetMin - sunriseMin;
  const rawProgress = daySpan > 0 ? (nowMin - sunriseMin) / daySpan : 0;
  const isDaytime   = rawProgress >= 0 && rawProgress <= 1;
  const clamped     = Math.max(0, Math.min(1, rawProgress));

  const sunPt  = bezier(clamped);
  const elapsed = totalLength * clamped;

  const dl = dayLength(sunriseTime, sunsetTime);

  // Moon position — based on actual progress through the overnight window,
  // not just clamped daytime progress. Total night = time from sunset to next sunrise.
  const nightDuration = (1440 - sunsetMin) + sunriseMin; // e.g. 180 + 335 = 515 min
  let moonX: number;
  let moonY: number;
  if (rawProgress < 0) {
    // Pre-dawn: nowMin is between 0 and sunriseMin.
    // nightProgress 0 = just-after-sunset, 1 = about-to-rise.
    const nightProgress = (1440 - sunsetMin + nowMin) / nightDuration;
    moonX = P0.x - 40 + 40 * nightProgress;  // slides from far-left toward sunrise
    moonY = P0.y - 15 * Math.sin(nightProgress * Math.PI);
  } else {
    // Post-sunset: nowMin is between sunsetMin and 1440.
    const nightProgress = (nowMin - sunsetMin) / nightDuration;
    moonX = P2.x + 40 * nightProgress;       // moves right away from sunset
    moonY = P2.y - 15 * Math.sin((1 - nightProgress) * Math.PI);
  }
  moonX = Math.max(-5, Math.min(405, moonX));
  moonY = Math.max(P1.y, Math.min(P0.y + 20, moonY));

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm px-5 pt-3 pb-2">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-1">Sun &amp; Sky</h2>

      <svg viewBox="0 0 400 120" className="w-full" style={{ height: 108 }} overflow="visible" aria-label="Sun arc">

        {/* Hidden path — used only to read getTotalLength() */}
        <path ref={pathRef} d={ARC_D} fill="none" stroke="none" />

        {/* Layer 1: full arc, dashed dim — the "remaining / night" portion */}
        <path
          d={ARC_D}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />

        {/* Layer 2: elapsed arc, solid gold — drawn on top from sunrise to now */}
        {totalLength > 0 && elapsed > 0 && (
          <path
            d={ARC_D}
            fill="none"
            stroke="rgba(251,191,36,0.85)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${elapsed} ${totalLength - elapsed}`}
            strokeDashoffset="0"
          />
        )}

        {/* Horizon line */}
        <line
          x1={P0.x} y1={P0.y}
          x2={P2.x} y2={P2.y}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />

        {/* Sun (daytime) */}
        {isDaytime && (
          <text x={sunPt.x} y={sunPt.y + 7} textAnchor="middle" fontSize="18">
            ☀️
          </text>
        )}

        {/* Moon (nighttime) — position computed from overnight progress above */}
        {!isDaytime && (
          <text x={moonX} y={moonY + 7} textAnchor="middle" fontSize="15">
            🌙
          </text>
        )}

        {/* Sunrise / sunset labels */}
        <text x={P0.x} y={P0.y + 16} fill="rgba(255,255,255,0.55)" fontSize="11" textAnchor="middle">
          {sunriseTime}
        </text>
        <text x={P2.x} y={P2.y + 16} fill="rgba(255,255,255,0.55)" fontSize="11" textAnchor="middle">
          {sunsetTime}
        </text>

        {/* Daylight duration */}
        {dl && (
          <text x="200" y={P0.y + 28} fill="rgba(255,255,255,0.5)" fontSize="10" textAnchor="middle">
            {dl}
          </text>
        )}

        {/* Nighttime label when sun is below horizon */}
        {!isDaytime && (
          <text x="200" y={P1.y + 8} fill="rgba(255,255,255,0.25)" fontSize="10" textAnchor="middle">
            night
          </text>
        )}
      </svg>

      {/* Elapsed / remaining legend */}
      {isDaytime && totalLength > 0 && (
        <div className="flex items-center justify-center gap-4 mt-1 mb-0.5 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-amber-400/80 rounded" />
            <span className="text-white/40">elapsed</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 border-t border-dashed border-white/30" />
            <span className="text-white/40">remaining</span>
          </span>
        </div>
      )}

      {moonPhase && (
        <p className="text-center text-white/40 text-xs mt-0.5">🌙 {moonPhase}</p>
      )}
    </div>
  );
}
