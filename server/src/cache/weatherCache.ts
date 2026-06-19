import NodeCache from 'node-cache';

const TTL = parseInt(process.env.CACHE_TTL_SECONDS ?? '600', 10);

const cache = new NodeCache({ stdTTL: TTL, checkperiod: TTL * 0.2 });

export function getCached<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setCached<T>(key: string, value: T, ttl?: number): void {
  if (ttl !== undefined) {
    cache.set(key, value, ttl);
  } else {
    cache.set(key, value);
  }
}

export function buildCacheKey(city: string, type: 'current' | 'forecast'): string {
  return `${city.toLowerCase().trim()}:${type}`;
}
