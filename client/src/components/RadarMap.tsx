import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RadarFrame { time: number; path: string; }
interface RainViewerData { host: string; radar: { past: RadarFrame[]; nowcast?: RadarFrame[] }; }
interface AllFrame extends RadarFrame { type: 'past' | 'nowcast'; }

interface Props { city: string; lat?: number | null; lon?: number | null; fullPage?: boolean; }

type ZoomPreset = 'local' | 'regional' | 'wide';
type MapType   = 'dark' | 'satellite' | 'light';
type AnimSpeed = 'slow' | 'normal' | 'fast';

const ZOOM_LEVELS: Record<ZoomPreset, number> = { local: 8, regional: 6, wide: 5 };
const ANIM_DELAYS: Record<AnimSpeed, number>   = { slow: 1400, normal: 600, fast: 220 };

const TILE_URLS: Record<MapType, string> = {
  dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light:     'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};
const TILE_ATTRIBS: Record<MapType, string> = {
  dark:      '&copy; <a href="https://carto.com/">CARTO</a>',
  light:     '&copy; <a href="https://carto.com/">CARTO</a>',
  satellite: '&copy; <a href="https://www.esri.com/">Esri</a>',
};

function relTime(ts: number, type: 'past' | 'nowcast'): string {
  const nowMs = Date.now();
  if (type === 'nowcast') {
    const m = Math.round((ts * 1000 - nowMs) / 60000);
    return m <= 0 ? 'Now' : `+${m}m`;
  }
  const m = Math.round((nowMs - ts * 1000) / 60000);
  if (m < 2)  return 'Now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60), rem = m % 60;
  return rem === 0 ? `${h}h ago` : `${h}h ${rem}m ago`;
}
function absTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function RadarMap({ city, lat: propLat, lon: propLon, fullPage = false }: Props) {
  const mapRef       = useRef<HTMLDivElement>(null);
  const leafletMap   = useRef<L.Map | null>(null);
  const radarLayer   = useRef<L.TileLayer | null>(null);
  const baseLayer    = useRef<L.TileLayer | null>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const hintTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [radarData,       setRadarData]       = useState<RainViewerData | null>(null);
  const [frameIdx,        setFrameIdx]        = useState(0);
  const [loading,         setLoading]         = useState(true);
  const [resolvedCoords,  setResolvedCoords]  = useState<{ lat: number; lon: number } | null>(
    propLat != null && propLon != null ? { lat: propLat, lon: propLon } : null,
  );

  const [playing,         setPlaying]         = useState(true);
  const [zoomPreset,      setZoomPreset]      = useState<ZoomPreset>('local');
  const [mapType,         setMapType]         = useState<MapType>(() =>
    document.documentElement.classList.contains('light') ? 'light' : 'dark',
  );
  const [animSpeed,       setAnimSpeed]       = useState<AnimSpeed>('normal');
  const [opacity,         setOpacity]         = useState(0.65);
  const [showLegend,      setShowLegend]      = useState(true);
  const [showInfo,        setShowInfo]        = useState(false);
  const [showNowcast,     setShowNowcast]     = useState(true);
  const [showHint,        setShowHint]        = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ── Resolve coords ──────────────────────────────────────────────
  useEffect(() => {
    if (propLat != null && propLon != null) { setResolvedCoords({ lat: propLat, lon: propLon }); return; }
    fetch(`/api/weather/geocode/search?q=${encodeURIComponent(city)}`)
      .then(r => r.json())
      .then(d => { const f = d.results?.[0]; if (f) setResolvedCoords({ lat: f.lat, lon: f.lon }); })
      .catch(() => {});
  }, [city, propLat, propLon]);

  // ── Fetch RainViewer ─────────────────────────────────────────────
  useEffect(() => {
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(r => r.json())
      .then((d: RainViewerData) => {
        setRadarData(d);
        setFrameIdx(d.radar.past.length - 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Mobile hint ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isMobile) return;
    setShowHint(true);
    hintTimer.current = setTimeout(() => setShowHint(false), 3000);
    return () => { if (hintTimer.current) clearTimeout(hintTimer.current); };
  }, [isMobile]);

  // ── Init Leaflet ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !resolvedCoords) return;
    if (leafletMap.current) {
      leafletMap.current.setView([resolvedCoords.lat, resolvedCoords.lon], ZOOM_LEVELS[zoomPreset]);
      return;
    }
    const map = L.map(mapRef.current, {
      center: [resolvedCoords.lat, resolvedCoords.lon],
      zoom: ZOOM_LEVELS[zoomPreset],
      zoomControl: true,
      attributionControl: true,
      dragging: !isMobile,
    });
    if (isMobile) { (map as any).tap?.disable(); map.scrollWheelZoom.enable(); }

    baseLayer.current = L.tileLayer(TILE_URLS[mapType], {
      attribution: TILE_ATTRIBS[mapType],
      subdomains: mapType === 'satellite' ? '' : 'abcd',
      maxZoom: 20,
    });
    baseLayer.current.addTo(map);
    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
      baseLayer.current  = null;
      radarLayer.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedCoords]);

  // ── Swap base tile when mapType changes ──────────────────────────
  useEffect(() => {
    if (!leafletMap.current || !baseLayer.current) return;
    baseLayer.current.setUrl(TILE_URLS[mapType]);
    baseLayer.current.options.attribution = TILE_ATTRIBS[mapType];
  }, [mapType]);

  // ── Swap radar tile when frame changes ───────────────────────────
  useEffect(() => {
    if (!leafletMap.current || !radarData) return;
    const combined = buildFrames(radarData, showNowcast);
    const frame = combined[frameIdx];
    if (!frame) return;
    if (radarLayer.current) leafletMap.current.removeLayer(radarLayer.current);
    const url = `${radarData.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
    radarLayer.current = L.tileLayer(url, { opacity, zIndex: 10, maxNativeZoom: 6, maxZoom: 18 });
    radarLayer.current.addTo(leafletMap.current);
  }, [radarData, frameIdx, showNowcast]); // opacity handled separately

  // ── Update opacity without re-adding layer ───────────────────────
  useEffect(() => {
    radarLayer.current?.setOpacity(opacity);
  }, [opacity]);

  // ── Animation loop ───────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!radarData || !playing) return;
    const total = buildFrames(radarData, showNowcast).length;
    intervalRef.current = setInterval(() => setFrameIdx(i => (i + 1) % total), ANIM_DELAYS[animSpeed]);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [radarData, playing, animSpeed, showNowcast]);

  // ── Derived values ───────────────────────────────────────────────
  const allFrames   = buildFrames(radarData, showNowcast);
  const pastCount   = radarData?.radar.past.length ?? 0;
  const currentFrame = allFrames[frameIdx];
  const hasNowcast  = (radarData?.radar.nowcast?.length ?? 0) > 0;

  function handleZoom(p: ZoomPreset) {
    setZoomPreset(p);
    leafletMap.current?.setZoom(ZOOM_LEVELS[p]);
  }

  return (
    <div className={`isolate rounded-2xl overflow-hidden border border-white/10 bg-[#0f172a] ${fullPage ? 'flex flex-col h-full' : ''}`}>

      {/* ── TOP TOOLBAR ── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white/5 border-b border-white/8 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">📡</span>
          <span className="text-white font-semibold text-sm">Radar</span>
          {currentFrame && (
            <span className="text-white/40 text-xs hidden sm:inline">
              {relTime(currentFrame.time, currentFrame.type)} · {absTime(currentFrame.time)}
            </span>
          )}
          {currentFrame?.type === 'nowcast' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-300 border border-purple-500/30 font-medium">
              Forecast ↗
            </span>
          )}
          {loading && <span className="text-white/30 text-xs animate-pulse">Loading…</span>}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {/* Zoom presets */}
          <div className="flex gap-0.5 bg-white/8 rounded-lg p-0.5">
            {(['local', 'regional', 'wide'] as ZoomPreset[]).map(z => (
              <button key={z} onClick={() => handleZoom(z)}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                  zoomPreset === z ? 'bg-blue-500/30 text-blue-300' : 'text-white/35 hover:text-white/65'
                }`}
              >{z}</button>
            ))}
          </div>

          {/* Map type */}
          <div className="flex gap-0.5 bg-white/8 rounded-lg p-0.5">
            {([['dark','🌙'],['satellite','🛰️'],['light','☀️']] as [MapType,string][]).map(([t, icon]) => (
              <button key={t} onClick={() => setMapType(t)} title={t}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${
                  mapType === t ? 'bg-white/20 text-white' : 'text-white/35 hover:text-white/65'
                }`}
              >{icon}</button>
            ))}
          </div>

          {/* Info toggle */}
          <button onClick={() => setShowInfo(v => !v)}
            className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-colors ${
              showInfo ? 'bg-blue-500/30 text-blue-300' : 'bg-white/8 text-white/40 hover:text-white/70'
            }`} title="How to read radar"
          >ℹ</button>
        </div>
      </div>

      {/* ── INFO PANEL ── */}
      {showInfo && (
        <div className="px-4 py-4 bg-slate-800/60 border-b border-white/8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-white/80 font-semibold mb-1.5">How to read this radar</p>
            <p className="text-white/50 leading-relaxed">
              Radar measures precipitation intensity using reflected radio waves.
              Brighter colours = heavier rain or snow. The animation replays the
              last ~2 hours of actual radar data, then continues into the
              <span className="text-purple-300"> Nowcast</span> — a short-term
              model projection of how precipitation will move in the next 30–60 minutes.
            </p>
          </div>
          <div>
            <p className="text-white/80 font-semibold mb-1.5">Zoom & controls</p>
            <ul className="text-white/50 leading-relaxed space-y-0.5">
              <li><span className="text-white/70">Local</span> — ~50 km view, best for "will it rain on me?"</li>
              <li><span className="text-white/70">Regional</span> — ~200 km, see incoming weather systems</li>
              <li><span className="text-white/70">Wide</span> — ~500 km, track large fronts</li>
              <li className="mt-1"><span className="text-purple-300">Nowcast</span> frames are model predictions, not observed data.</li>
            </ul>
            <p className="text-white/25 mt-2">Data: RainViewer · Updates every 10 min</p>
          </div>
        </div>
      )}

      {/* ── MAP ── */}
      <div className={`relative ${fullPage ? 'flex-1 min-h-0' : ''}`}>
        <div ref={mapRef} style={{
          height: fullPage ? '100%' : 560,
          minHeight: fullPage ? 0 : undefined,
          width: '100%',
          background: '#0f172a',
          touchAction: isMobile ? 'pan-y' : 'auto',
        }} />

        {/* Radar colour legend */}
        {showLegend && (
          <div className="absolute bottom-4 left-4 bg-black/75 backdrop-blur-sm rounded-xl px-3 py-2.5 select-none">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1.5 font-semibold">Precipitation intensity</p>
            <div className="h-3 w-48 rounded" style={{
              background: 'linear-gradient(to right,#a0ffa0 0%,#00c800 18%,#c8ff00 32%,#ffff00 46%,#ff9000 60%,#ff0000 75%,#c80000 87%,#ff00ff 100%)',
            }} />
            <div className="flex justify-between text-[10px] text-white/35 mt-1 w-48">
              <span>Trace</span><span>Light</span><span>Mod.</span><span>Heavy</span><span>Extreme</span>
            </div>
          </div>
        )}

        {/* Nowcast badge on map */}
        {currentFrame?.type === 'nowcast' && (
          <div className="absolute top-3 right-3 bg-purple-900/80 backdrop-blur-sm border border-purple-500/40 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-purple-300 font-semibold">Model forecast</span>
            <span className="text-purple-400/60 ml-1.5">{relTime(currentFrame.time, 'nowcast')}</span>
          </div>
        )}

        {/* Mobile pan hint */}
        {isMobile && showHint && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
            <div className="bg-black/65 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full pointer-events-auto"
              onClick={() => setShowHint(false)}>
              Use two fingers to pan the map
            </div>
          </div>
        )}
      </div>

      {/* ── PLAYBACK CONTROLS ── */}
      <div className="px-4 pt-3 pb-3 bg-white/5 border-t border-white/8 space-y-3">

        {/* Control row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Step ‹ */}
          <button onClick={() => { setPlaying(false); setFrameIdx(i => Math.max(0, i - 1)); }}
            className="w-8 h-8 rounded-lg bg-white/8 text-white/50 hover:text-white flex items-center justify-center">
            ‹
          </button>

          {/* Play / Pause */}
          <button onClick={() => setPlaying(p => !p)}
            className="w-9 h-9 rounded-xl bg-blue-500/20 hover:bg-blue-500/35 text-blue-300 flex items-center justify-center text-lg transition-colors">
            {playing ? '⏸' : '▶'}
          </button>

          {/* Step › */}
          <button onClick={() => { setPlaying(false); setFrameIdx(i => Math.min(allFrames.length - 1, i + 1)); }}
            className="w-8 h-8 rounded-lg bg-white/8 text-white/50 hover:text-white flex items-center justify-center">
            ›
          </button>

          {/* Jump to latest */}
          <button onClick={() => { setPlaying(false); setFrameIdx(pastCount - 1); }}
            className="text-xs px-2.5 py-1 rounded-lg bg-white/8 text-white/40 hover:text-white/70 transition-colors">
            Latest
          </button>

          {/* Speed */}
          <div className="flex gap-0.5 bg-white/8 rounded-lg p-0.5">
            {([['slow','½×'],['normal','1×'],['fast','2×']] as [AnimSpeed,string][]).map(([s, label]) => (
              <button key={s} onClick={() => setAnimSpeed(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  animSpeed === s ? 'bg-white/20 text-white' : 'text-white/30 hover:text-white/60'
                }`}
              >{label}</button>
            ))}
          </div>

          {/* Nowcast toggle */}
          {hasNowcast && (
            <button onClick={() => setShowNowcast(v => !v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                showNowcast ? 'bg-purple-500/25 text-purple-300 border border-purple-500/30' : 'bg-white/8 text-white/30 hover:text-white/55'
              }`}
            >Nowcast {showNowcast ? 'on' : 'off'}</button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {/* Opacity */}
            <span className="text-white/25 text-[10px] hidden sm:inline">Opacity</span>
            <input type="range" min={20} max={90} value={Math.round(opacity * 100)}
              onChange={e => setOpacity(Number(e.target.value) / 100)}
              className="w-16 accent-blue-400 cursor-pointer h-1" />

            {/* Legend toggle */}
            <button onClick={() => setShowLegend(v => !v)}
              className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                showLegend ? 'bg-white/12 text-white/55' : 'bg-white/5 text-white/25 hover:text-white/45'
              }`}
            >Legend</button>
          </div>
        </div>

        {/* ── SCRUBBER ── */}
        {allFrames.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex gap-0.5 items-center">
              {allFrames.map((f, i) => {
                const isNowcastDivider = i === pastCount && f.type === 'nowcast';
                return (
                  <button
                    key={`${f.time}-${f.type}`}
                    onClick={() => { setPlaying(false); setFrameIdx(i); }}
                    title={`${absTime(f.time)} (${relTime(f.time, f.type)})`}
                    className={[
                      'flex-1 rounded-sm transition-all',
                      i === frameIdx ? 'h-3' : 'h-2 hover:h-2.5',
                      i === frameIdx
                        ? f.type === 'nowcast' ? 'bg-purple-400' : 'bg-blue-400'
                        : f.type === 'nowcast'
                        ? 'bg-purple-500/30 hover:bg-purple-400/55'
                        : 'bg-white/18 hover:bg-white/35',
                      isNowcastDivider ? 'ml-2' : '',
                    ].join(' ')}
                  />
                );
              })}
            </div>

            {/* Time labels */}
            <div className="relative flex justify-between text-[10px] text-white/25 px-0.5">
              <span>{absTime(allFrames[0].time)}</span>

              {/* NOW marker — positioned at boundary */}
              {hasNowcast && showNowcast && pastCount > 0 && pastCount < allFrames.length && (
                <span className="absolute text-white/50 font-semibold -translate-x-1/2"
                  style={{ left: `${(pastCount / allFrames.length) * 100}%` }}>
                  Now
                </span>
              )}

              {allFrames.length > 1 && (
                <span className={hasNowcast && showNowcast ? 'text-purple-400/60' : ''}>
                  {absTime(allFrames[allFrames.length - 1].time)}
                  {hasNowcast && showNowcast && ' ↗'}
                </span>
              )}
            </div>

            {/* Legend labels below scrubber */}
            <div className="flex gap-3 text-[10px] text-white/25 pt-0.5">
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 h-1.5 rounded-sm bg-white/20" />
                Past radar
              </span>
              {hasNowcast && showNowcast && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-5 h-1.5 rounded-sm bg-purple-500/40" />
                  Nowcast (model)
                </span>
              )}
              <span className="ml-auto">RainViewer · 10 min intervals</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildFrames(data: RainViewerData | null, includeNowcast: boolean): AllFrame[] {
  if (!data) return [];
  return [
    ...data.radar.past.map(f => ({ ...f, type: 'past' as const })),
    ...(includeNowcast ? (data.radar.nowcast ?? []) : []).map(f => ({ ...f, type: 'nowcast' as const })),
  ];
}
