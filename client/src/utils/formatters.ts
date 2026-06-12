export function celsiusToFahrenheit(c: number): number {
  return parseFloat(((c * 9) / 5 + 32).toFixed(1));
}

export function formatTemp(celsius: number, unit: 'C' | 'F'): string {
  const val = unit === 'F' ? celsiusToFahrenheit(celsius) : celsius;
  return `${Math.round(val)}°${unit}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function conditionCodeToEmoji(code: string): string {
  const map: Record<string, string> = {
    clear: '☀️',
    partly_cloudy: '⛅',
    cloudy: '☁️',
    fog: '🌫️',
    drizzle: '🌦️',
    rain: '🌧️',
    snow: '❄️',
    rain_showers: '🌦️',
    snow_showers: '🌨️',
    thunderstorm: '⛈️',
    unknown: '🌡️',
  };
  return map[code] ?? '🌡️';
}

export function confidenceLabel(score: number): string {
  if (score >= 80) return 'Strong Agreement';
  if (score >= 60) return 'Moderate Agreement';
  if (score >= 40) return 'Low Agreement';
  return 'Disputed';
}

const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function degreesToCompass(deg: number): string {
  return COMPASS_POINTS[Math.round(deg / 22.5) % 16];
}

export function uvRisk(uvi: number): { label: string; color: string } {
  if (uvi <= 2) return { label: 'Low', color: 'text-emerald-400' };
  if (uvi <= 5) return { label: 'Moderate', color: 'text-yellow-400' };
  if (uvi <= 7) return { label: 'High', color: 'text-orange-400' };
  if (uvi <= 10) return { label: 'Very High', color: 'text-red-400' };
  return { label: 'Extreme', color: 'text-purple-400' };
}

export function dayLength(sunriseStr: string, sunsetStr: string): string {
  // Expects strings like "6:43 AM" and "8:21 PM"
  const parse = (s: string) => {
    const d = new Date(`1970-01-01 ${s}`);
    return isNaN(d.getTime()) ? null : d;
  };
  const rise = parse(sunriseStr);
  const set = parse(sunsetStr);
  if (!rise || !set) return '';
  const totalMin = Math.round((set.getTime() - rise.getTime()) / 60000);
  if (totalMin <= 0) return '';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m of daylight`;
}
