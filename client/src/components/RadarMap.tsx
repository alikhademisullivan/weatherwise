import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RadarFrame {
  time: number;
  path: string;
}

interface RainViewerData {
  host: string;
  radar: { past: RadarFrame[]; nowcast?: RadarFrame[] };
}

interface Props {
  city: string;
  lat?: number | null;
  lon?: number | null;
}

export default function RadarMap({ city, lat: propLat, lon: propLon }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const radarLayer = useRef<L.TileLayer | null>(null);

  const [radarData, setRadarData] = useState<RainViewerData | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lon: number } | null>(
    propLat != null && propLon != null ? { lat: propLat, lon: propLon } : null,
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve coordinates if not provided
  useEffect(() => {
    if (propLat != null && propLon != null) {
      setResolvedCoords({ lat: propLat, lon: propLon });
      return;
    }
    fetch(`/api/weather/geocode/search?q=${encodeURIComponent(city)}`)
      .then(r => r.json())
      .then(d => {
        const first = d.results?.[0];
        if (first) setResolvedCoords({ lat: first.lat, lon: first.lon });
      })
      .catch(() => {});
  }, [city, propLat, propLon]);

  // Fetch RainViewer frames
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

  // Initialise Leaflet map once the div is mounted and coords are known
  useEffect(() => {
    if (!mapRef.current || !resolvedCoords) return;

    // Re-centre if map already exists (city switched)
    if (leafletMap.current) {
      leafletMap.current.setView([resolvedCoords.lat, resolvedCoords.lon], 9);
      return;
    }

    const map = L.map(mapRef.current, {
      center: [resolvedCoords.lat, resolvedCoords.lon],
      zoom: 9,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, [resolvedCoords]);

  // Swap radar tile layer when frame or data changes
  useEffect(() => {
    if (!leafletMap.current || !radarData || !radarData.radar.past.length) return;

    const frame = radarData.radar.past[frameIdx];
    if (!frame) return;

    if (radarLayer.current) {
      leafletMap.current.removeLayer(radarLayer.current);
      radarLayer.current = null;
    }

    const url = `${radarData.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
    // maxNativeZoom: RainViewer radar tiles only exist up to zoom 6.
    // Leaflet will scale those tiles up for higher zoom levels instead of
    // requesting non-existent tiles (which caused "zoom level not supported").
    radarLayer.current = L.tileLayer(url, { opacity: 0.6, zIndex: 10, maxNativeZoom: 6, maxZoom: 18 });
    radarLayer.current.addTo(leafletMap.current);
  }, [radarData, frameIdx]);

  // Animation loop
  useEffect(() => {
    if (!radarData || !playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    const total = radarData.radar.past.length;
    intervalRef.current = setInterval(() => {
      setFrameIdx(i => (i + 1) % total);
    }, 600);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [radarData, playing]);

  const frames = radarData?.radar.past ?? [];
  const currentFrame = frames[frameIdx];
  const frameTime = currentFrame
    ? new Date(currentFrame.time * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '';

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 backdrop-blur-sm">
        <div>
          <span className="text-white/80 text-sm font-semibold">Radar</span>
          {frameTime && <span className="text-white/40 text-xs ml-2">{frameTime}</span>}
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-white/40 text-xs animate-pulse">Loading…</span>}
          <button
            onClick={() => setPlaying(p => !p)}
            className="text-xs px-2.5 py-1 rounded-md bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          {frames.length > 1 && (
            <div className="flex gap-0.5">
              <button
                onClick={() => { setPlaying(false); setFrameIdx(i => Math.max(0, i - 1)); }}
                className="w-6 h-6 rounded bg-white/10 text-white/60 hover:text-white text-xs flex items-center justify-center"
              >‹</button>
              <button
                onClick={() => { setPlaying(false); setFrameIdx(i => Math.min(frames.length - 1, i + 1)); }}
                className="w-6 h-6 rounded bg-white/10 text-white/60 hover:text-white text-xs flex items-center justify-center"
              >›</button>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ height: 300, width: '100%', background: '#0f172a' }} />

      {/* Frame scrubber */}
      {frames.length > 1 && (
        <div className="flex gap-0.5 px-4 py-2 bg-white/5">
          {frames.map((f, i) => (
            <button
              key={f.time}
              onClick={() => { setPlaying(false); setFrameIdx(i); }}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i === frameIdx ? 'bg-blue-400' : 'bg-white/20 hover:bg-white/35'
              }`}
              title={new Date(f.time * 1000).toLocaleTimeString()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
