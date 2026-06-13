import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface SourceEntry {
  name: string;
  value: number;
  isOutlier: boolean;
}

export interface StatTooltipProps {
  label: string;
  unit: string;
  value?: number | string;
  sources: SourceEntry[];
  interpretation: string;
  trend?: 'rising' | 'falling' | 'stable';
  trendLabel?: string;
  children: ReactNode;
}

const BG = '#0f172a';
const BORDER = '1px solid rgba(255,255,255,0.12)';
const DIVIDER = '1px solid rgba(255,255,255,0.1)';
const SHADOW = '0 8px 32px rgba(0,0,0,0.6)';
const TOOLTIP_W = 300;

// Consistent per-source identity colors, same throughout the app.
const SOURCE_COLORS: Record<string, string> = {
  'Open-Meteo': '#38bdf8',
  'OpenWeatherMap': '#34d399',
  'Tomorrow.io': '#a78bfa',
  'WeatherAPI': '#fbbf24',
};
const FALLBACK_COLOR = '#94a3b8';

interface TooltipPos {
  left: number;
  below: boolean;
  // fixed-position vertical value:
  // below=true  → top (px from viewport top)
  // below=false → bottom (px from viewport bottom)
  vert: number;
  caretLeft: number; // px from tooltip left edge to caret center
}

function calcPos(el: HTMLElement): TooltipPos {
  const rect = el.getBoundingClientRect();
  const center = rect.left + rect.width / 2;
  const nearRight = window.innerWidth - rect.right < 160;

  let left = nearRight ? rect.right - TOOLTIP_W : center - TOOLTIP_W / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_W - 8));

  const caretLeft = Math.max(16, Math.min(center - left, TOOLTIP_W - 16));
  const below = rect.top < 300;

  return {
    left,
    below,
    vert: below ? rect.bottom + 8 : window.innerHeight - rect.top + 8,
    caretLeft,
  };
}

function useTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia('(hover: none)').matches);
  }, []);
  return isTouch;
}

export default function StatTooltip({
  label, unit, value, sources, interpretation, trend, trendLabel, children,
}: StatTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouch = useTouchDevice();

  useEffect(() => { setMounted(true); }, []);

  const consensusNum = typeof value === 'number' ? value : 0;
  const closestIdx = sources.length > 1
    ? sources.reduce((best, s, i) =>
        Math.abs(s.value - consensusNum) < Math.abs(sources[best].value - consensusNum) ? i : best, 0)
    : 0;

  const vals = sources.map(s => s.value);
  const lo = vals.length ? Math.min(...vals) : 0;
  const hi = vals.length ? Math.max(...vals) : 0;
  const span = hi - lo || 1;
  const barPct = (v: number) => span === 0 ? 60 : Math.round(((v - lo) / span) * 70 + 20);

  const computePos = useCallback(() => {
    if (wrapperRef.current) setPos(calcPos(wrapperRef.current));
  }, []);

  const showTip = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    computePos();
    setVisible(true);
  }, [computePos]);

  const hideTip = useCallback(() => {
    hideTimer.current = setTimeout(() => setVisible(false), 150);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    if (!visible || !isTouch) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('touchstart', close);
    document.addEventListener('mousedown', close);
    return () => {
      document.removeEventListener('touchstart', close);
      document.removeEventListener('mousedown', close);
    };
  }, [visible, isTouch]);

  const handleClick = (e: React.MouseEvent) => {
    if (!isTouch) return;
    e.stopPropagation();
    if (!visible) computePos();
    setVisible(v => !v);
  };

  const trendColor = trend === 'rising' ? '#34d399' : trend === 'falling' ? '#f87171' : '#94a3b8';
  const trendArrow = trend === 'rising' ? '↗' : trend === 'falling' ? '↘' : '→';

  const box: CSSProperties = {
    background: BG,
    border: BORDER,
    borderRadius: 12,
    padding: 16,
    width: TOOLTIP_W,
    boxShadow: SHADOW,
  };

  const tooltipBox = (
    <div
      style={box}
      onMouseEnter={!isTouch ? cancelHide : undefined}
      onMouseLeave={!isTouch ? hideTip : undefined}
    >
      {/* Header: stat name left, consensus value right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: '#94a3b8',
        }}>
          {label}
        </span>
        {value != null && value !== '' && (
          <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            {value}{unit}
          </span>
        )}
      </div>

      {/* Source bar chart */}
      {sources.length > 0 && (
        <>
          <div style={{ borderTop: DIVIDER, marginBottom: 10 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {sources.map((s, i) => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
                {/* Source name: fixed 90px, truncated */}
                <span style={{
                  width: 90, fontSize: 12, fontWeight: 500, color: '#d1d5db',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {s.name}
                </span>
                {/* Bar track + fill */}
                <div style={{
                  flex: 1, height: 8, borderRadius: 4,
                  background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden', minWidth: 0,
                }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${barPct(s.value)}%`,
                    background: SOURCE_COLORS[s.name] ?? FALLBACK_COLOR,
                  }} />
                </div>
                {/* Value: fixed 60px, right-aligned */}
                <span style={{
                  width: 60, fontSize: 14, fontWeight: 700, color: '#fff',
                  textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                }}>
                  {s.value}{unit}
                </span>
                {/* Status icon: checkmark or warning */}
                <span style={{ width: 16, textAlign: 'center', flexShrink: 0, fontSize: 13, lineHeight: '1' }}>
                  {i === closestIdx && sources.length > 1
                    ? <span style={{ color: '#34d399' }}>✓</span>
                    : s.isOutlier
                    ? <span style={{ color: '#fbbf24' }}>⚠</span>
                    : null}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Trend line */}
      {trend && (
        <div style={{
          borderTop: DIVIDER, paddingTop: 10, marginTop: 10,
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: trendColor,
        }}>
          <span>{trendArrow}</span>
          <span>{trendLabel ?? (trend === 'rising' ? 'Rising' : trend === 'falling' ? 'Falling' : 'Stable')}</span>
        </div>
      )}

      {/* Interpretation */}
      <div style={{
        borderTop: DIVIDER, marginTop: 10, paddingTop: 10,
        fontSize: 12, color: '#94a3b8', lineHeight: 1.5,
      }}>
        {interpretation}
      </div>
    </div>
  );

  // Desktop: render via portal with fixed positioning so it escapes overflow:hidden parents.
  const desktopPortal = pos ? (
    <div
      style={{
        position: 'fixed',
        left: pos.left,
        width: TOOLTIP_W,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        ...(pos.below ? { top: pos.vert } : { bottom: pos.vert }),
      }}
    >
      {/* Upward caret when tooltip is below the card */}
      {pos.below && (
        <div style={{ paddingLeft: pos.caretLeft - 8, lineHeight: 0, marginBottom: -1 }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: `8px solid ${BG}`,
          }} />
        </div>
      )}

      {tooltipBox}

      {/* Downward caret when tooltip is above the card */}
      {!pos.below && (
        <div style={{ paddingLeft: pos.caretLeft - 8, lineHeight: 0, marginTop: -1 }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: `8px solid ${BG}`,
          }} />
        </div>
      )}
    </div>
  ) : null;

  // Mobile: expand inline below the card (no portal, no fixed position).
  const mobileContent = (
    <div style={{ marginTop: 8 }}>
      {tooltipBox}
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className="relative group"
      onMouseEnter={!isTouch ? showTip : undefined}
      onMouseLeave={!isTouch ? hideTip : undefined}
      onClick={isTouch ? handleClick : undefined}
    >
      {children}
      {visible && !isTouch && mounted && desktopPortal && createPortal(desktopPortal, document.body)}
      {visible && isTouch && mobileContent}
    </div>
  );
}
