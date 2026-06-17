import type { ConsensusReading, HourlyReading, SourceReading } from '../types/weather';
import { celsiusToFahrenheit, formatTemp, degreesToCompass, uvRisk, dayLength, formatWind, kphToMph, windSpeedUnit } from '../utils/formatters';
import StatTooltip from './StatTooltip';

interface Props {
  consensus: ConsensusReading;
  unit: 'C' | 'F';
  mode?: 'hero' | 'details';
  hourly?: HourlyReading[];
}

interface TileProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  hasTooltip?: boolean;
}

function Tile({ icon, label, value, sub, warn, hasTooltip }: TileProps) {
  return (
    <div className="relative flex flex-col gap-1 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
      {hasTooltip && (
        <span className="absolute top-3 right-3 text-white/30 group-hover:text-white/70 transition-colors text-xs select-none leading-none pointer-events-none">
          ℹ
        </span>
      )}
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
        {warn && (
          <span className="text-amber-400 text-xs mr-4" title="Sources disagree on this value">⚠</span>
        )}
      </div>
      <span className="text-white font-semibold text-sm">{value}</span>
      <span className="text-white/50 text-xs">{label}</span>
      {sub && <span className="text-white/35 text-xs">{sub}</span>}
    </div>
  );
}

function pressureLabel(hpa: number): string {
  if (hpa > 1020) return 'High pressure · fair weather';
  if (hpa < 1000) return 'Low pressure · unsettled';
  return 'Variable';
}

function cloudLabel(pct: number): string {
  if (pct < 20) return 'Clear skies';
  if (pct < 50) return 'Partly cloudy';
  if (pct < 85) return 'Mostly cloudy';
  return 'Overcast';
}

function visibilityLabel(km: number): string {
  if (km >= 10) return 'Clear';
  if (km >= 5) return 'Good';
  if (km >= 2) return 'Moderate';
  return 'Reduced';
}

// Returns sources array with outlier flags for a specific numeric field.
function buildSources(
  sources: SourceReading[],
  consensusVal: number,
  getField: (s: SourceReading) => number | undefined,
): { name: string; value: number; isOutlier: boolean }[] {
  const filtered = sources.flatMap(s => {
    const v = getField(s);
    return v != null ? [{ name: s.source, value: v }] : [];
  });
  if (!filtered.length) return [];

  let maxDiff = -1;
  let outlierIdx = -1;
  filtered.forEach((s, i) => {
    const diff = Math.abs(s.value - consensusVal);
    if (diff > maxDiff) { maxDiff = diff; outlierIdx = i; }
  });

  return filtered.map((s, i) => ({
    ...s,
    isOutlier: filtered.length > 1 && i === outlierIdx,
  }));
}

// Compute a time-based trend from the first few hourly entries.
function computeTrend(
  hours: HourlyReading[] | undefined,
  getField: (h: HourlyReading) => number,
  unitLabel: string,
  threshold: number,
): { trend: 'rising' | 'falling' | 'stable'; trendLabel: string } | undefined {
  if (!hours || hours.length < 4) return undefined;
  const current = getField(hours[0]);
  const future = getField(hours[3]);
  const delta = future - current;
  if (delta > threshold) {
    return { trend: 'rising', trendLabel: `Rising to ${Math.round(future)}${unitLabel} over the next 3 hours` };
  }
  if (delta < -threshold) {
    return { trend: 'falling', trendLabel: `Falling to ${Math.round(future)}${unitLabel} over the next 3 hours` };
  }
  return { trend: 'stable', trendLabel: 'Stable over the next few hours' };
}

// Parse "6:43 AM" style time strings, offset by minutes, return formatted.
function offsetTimeStr(timeStr: string, offsetMins: number): string {
  const d = new Date(`1970-01-01 ${timeStr}`);
  if (isNaN(d.getTime())) return timeStr;
  d.setMinutes(d.getMinutes() + offsetMins);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function spreadOf(vals: number[]): number {
  if (vals.length < 2) return 0;
  return Math.round(Math.max(...vals) - Math.min(...vals));
}

export default function DetailsPanel({ consensus, unit, mode = 'details', hourly }: Props) {
  const fs = consensus.fieldSpreads;
  const convertTemp = (c: number) => Math.round(unit === 'F' ? celsiusToFahrenheit(c) : c);
  const tempUnit = `°${unit}`;

  if (mode === 'hero') {
    const windValue = consensus.windDirection != null
      ? `${formatWind(consensus.windSpeed, unit)} ${degreesToCompass(consensus.windDirection)}`
      : formatWind(consensus.windSpeed, unit);

    // ── Feels Like ──────────────────────────────────────────────────────────
    const flRaw = buildSources(consensus.sources, consensus.feelsLike, s => s.feelsLike);
    const flSources = flRaw.map(s => ({ ...s, value: convertTemp(s.value) }));
    const flSpread = spreadOf(flSources.map(s => s.value));
    const flInterp = flSpread <= 2
      ? `Sources agree within ${flSpread}°`
      : `Sources split by ${flSpread}° — consider the full range`;

    // ── Humidity ────────────────────────────────────────────────────────────
    const humSources = buildSources(consensus.sources, consensus.humidity, s => s.humidity)
      .map(s => ({ ...s, value: Math.round(s.value) }));
    const humSpread = spreadOf(humSources.map(s => s.value));
    const humInterp = humSpread <= 5
      ? `Sources agree within ${humSpread}%`
      : `Spread of ${humSpread}% across sources`;

    // ── Wind ────────────────────────────────────────────────────────────────
    const windSources = buildSources(consensus.sources, consensus.windSpeed, s => s.windSpeed)
      .map(s => ({ ...s, value: Math.round(unit === 'F' ? kphToMph(s.value) : s.value) }));
    const windSpread = spreadOf(windSources.map(s => s.value));
    const wUnit = windSpeedUnit(unit);
    const gustInfo = consensus.windGust ? ` · Gusts up to ${formatWind(consensus.windGust, unit)}` : '';
    const windInterp = `Sources within ${windSpread}${wUnit}${gustInfo}`;
    const windTrend = computeTrend(hourly, h => unit === 'F' ? kphToMph(h.windSpeed) : h.windSpeed, windSpeedUnit(unit), unit === 'F' ? 3 : 5);

    // ── Precipitation ───────────────────────────────────────────────────────
    const precipSources = buildSources(
      consensus.sources, consensus.precipitationProbability, s => s.precipitationProbability,
    ).map(s => ({ ...s, value: Math.round(s.value) }));
    const precipVals = precipSources.map(s => s.value);
    const mmInfo = consensus.precipitationMm ? ` · ${consensus.precipitationMm} mm total` : '';
    const precipInterp = precipVals.length > 1
      ? `Probability ranges ${Math.min(...precipVals)}%–${Math.max(...precipVals)}% across sources${mmInfo}`
      : `${precipVals[0] ?? consensus.precipitationProbability}% probability${mmInfo}`;

    return (
      <div className="grid grid-cols-2 gap-2">
        <StatTooltip
          label="Feels Like" unit={tempUnit}
          value={convertTemp(consensus.feelsLike)}
          sources={flSources} interpretation={flInterp}
        >
          <Tile icon="🌡️" label="Feels Like" value={formatTemp(consensus.feelsLike, unit)} sub="Wind & humidity" hasTooltip />
        </StatTooltip>

        <StatTooltip
          label="Humidity" unit="%"
          value={consensus.humidity}
          sources={humSources} interpretation={humInterp}
        >
          <Tile
            icon="💧" label="Humidity"
            value={`${consensus.humidity}%`}
            sub={consensus.dewPoint != null ? `Dew ${formatTemp(consensus.dewPoint, unit)}` : undefined}
            warn={fs?.humidity != null && fs.humidity > 20}
            hasTooltip
          />
        </StatTooltip>

        <StatTooltip
          label="Wind" unit={windSpeedUnit(unit)}
          value={Math.round(unit === 'F' ? kphToMph(consensus.windSpeed) : consensus.windSpeed)}
          sources={windSources} interpretation={windInterp}
          trend={windTrend?.trend} trendLabel={windTrend?.trendLabel}
        >
          <Tile
            icon="💨" label="Wind"
            value={windValue}
            sub={consensus.windGust != null ? `Gusts ${formatWind(consensus.windGust, unit)}` : undefined}
            warn={fs?.windSpeed != null && fs.windSpeed > 15}
            hasTooltip
          />
        </StatTooltip>

        <StatTooltip
          label="Precipitation" unit="%"
          value={consensus.precipitationProbability}
          sources={precipSources} interpretation={precipInterp}
        >
          <Tile
            icon="🌧️" label="Precip"
            value={`${consensus.precipitationProbability}%`}
            sub={consensus.precipitationMm != null ? `${consensus.precipitationMm} mm` : undefined}
            warn={fs?.precipitationProbability != null && fs.precipitationProbability > 30}
            hasTooltip
          />
        </StatTooltip>
      </div>
    );
  }

  // ── Details mode: secondary stats ─────────────────────────────────────────
  const tiles: React.ReactNode[] = [];

  if (consensus.uvIndex != null) {
    const uv = uvRisk(consensus.uvIndex);
    const uvRaw = buildSources(consensus.sources, consensus.uvIndex, s => s.uvIndex)
      .map(s => ({ ...s, value: parseFloat(s.value.toFixed(1)) }));
    const reportingCount = uvRaw.length;
    const missingCount = consensus.sources.length - reportingCount;
    const uvVals = uvRaw.map(s => s.value);
    const uvSpread = uvVals.length > 1
      ? parseFloat((Math.max(...uvVals) - Math.min(...uvVals)).toFixed(1))
      : 0;
    const uvInterp = [
      missingCount > 0
        ? `${missingCount} source${missingCount > 1 ? 's do' : ' does'} not report UV.`
        : null,
      uvSpread <= 1 ? 'Sources agree on UV level.' : `UV spread of ${uvSpread} across sources.`,
    ].filter(Boolean).join(' ');

    tiles.push(
      <StatTooltip
        key="uv"
        label="UV Index" unit=""
        value={consensus.uvIndex.toFixed(1)}
        sources={uvRaw} interpretation={uvInterp}
      >
        <Tile
          icon="☀️" label="UV Index"
          value={`${consensus.uvIndex.toFixed(0)} · ${uv.label}`}
          sub="Wear SPF 30+ above 6"
          warn={fs?.uvIndex != null && fs.uvIndex > 2}
          hasTooltip
        />
      </StatTooltip>,
    );
  }

  if (consensus.pressure != null) {
    const presSources = buildSources(consensus.sources, consensus.pressure, s => s.pressure)
      .map(s => ({ ...s, value: Math.round(s.value) }));
    const presSpread = spreadOf(presSources.map(s => s.value));
    const presInterp = `${pressureLabel(consensus.pressure)} · Sources within ${presSpread} hPa`;

    tiles.push(
      <StatTooltip
        key="pressure"
        label="Pressure" unit=" hPa"
        value={consensus.pressure}
        sources={presSources} interpretation={presInterp}
      >
        <Tile
          icon="🔽" label="Pressure"
          value={`${consensus.pressure} hPa`}
          sub={pressureLabel(consensus.pressure)}
          warn={fs?.pressure != null && fs.pressure > 10}
          hasTooltip
        />
      </StatTooltip>,
    );
  }

  if (consensus.visibility != null) {
    const visSources = buildSources(consensus.sources, consensus.visibility, s => s.visibility)
      .map(s => ({ ...s, value: parseFloat(s.value.toFixed(1)) }));
    const visVals = visSources.map(s => s.value);
    const visRange = visVals.length > 1 ? Math.max(...visVals) - Math.min(...visVals) : 0;
    const visInterp = visRange > 1
      ? `Visibility ranges ${Math.min(...visVals).toFixed(0)}–${Math.max(...visVals).toFixed(0)} km across sources`
      : 'All sources agree on visibility';

    tiles.push(
      <StatTooltip
        key="visibility"
        label="Visibility" unit=" km"
        value={consensus.visibility}
        sources={visSources} interpretation={visInterp}
      >
        <Tile
          icon="👁️" label="Visibility"
          value={`${consensus.visibility} km`}
          sub={visibilityLabel(consensus.visibility)}
          hasTooltip
        />
      </StatTooltip>,
    );
  }

  if (consensus.cloudCover != null) {
    const cloudSources = buildSources(consensus.sources, consensus.cloudCover, s => s.cloudCover)
      .map(s => ({ ...s, value: Math.round(s.value) }));
    const cloudVals = cloudSources.map(s => s.value);
    const cloudSpread = spreadOf(cloudVals);
    const cloudInterp = cloudSpread <= 10
      ? `Sources agree within ${cloudSpread}%`
      : `Cloud cover varies ${Math.min(...cloudVals)}%–${Math.max(...cloudVals)}% across sources`;

    tiles.push(
      <StatTooltip
        key="cloud"
        label="Cloud Cover" unit="%"
        value={consensus.cloudCover}
        sources={cloudSources} interpretation={cloudInterp}
      >
        <Tile
          icon="☁️" label="Cloud Cover"
          value={`${consensus.cloudCover}%`}
          sub={cloudLabel(consensus.cloudCover)}
          hasTooltip
        />
      </StatTooltip>,
    );
  }

  if (consensus.sunriseTime && consensus.sunsetTime) {
    const dl = dayLength(consensus.sunriseTime, consensus.sunsetTime);
    const goldenMorningEnd = offsetTimeStr(consensus.sunriseTime, 60);
    const goldenEveningStart = offsetTimeStr(consensus.sunsetTime, -60);
    const sunInterp = [
      dl || null,
      `Golden hour: ${consensus.sunriseTime}–${goldenMorningEnd}`,
      `Evening: ${goldenEveningStart}–${consensus.sunsetTime}`,
    ].filter(Boolean).join(' · ');

    tiles.push(
      <StatTooltip
        key="sun"
        label="Sunrise / Sunset" unit=""
        sources={[]} interpretation={sunInterp}
      >
        <Tile
          icon="🌅" label="Sunrise / Sunset"
          value={`${consensus.sunriseTime} · ${consensus.sunsetTime}`}
          sub={dl || undefined}
          hasTooltip
        />
      </StatTooltip>,
    );
  }

  if (!tiles.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tiles}
    </div>
  );
}
