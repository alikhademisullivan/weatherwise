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
