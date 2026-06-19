import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { LocalSensorResponse } from '../types/weather';

type Coords = { lat: number; lon: number } | null | undefined;

export function useLocalSensors(coords: Coords, city?: string) {
  const hasLocation = coords != null || (city != null && city.trim().length > 0);

  return useQuery<LocalSensorResponse>({
    queryKey: ['weather', 'local-sensors', coords?.lat, coords?.lon, city],
    queryFn: async () => {
      const params = coords
        ? { lat: coords.lat, lon: coords.lon }
        : { city };
      const { data } = await axios.get<LocalSensorResponse>('/api/weather/local-sensors', { params });
      return data;
    },
    enabled: hasLocation,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    // 404 = Netatmo not configured or no stations found; don't retry those.
    retry: (count, error: any) => count < 1 && error?.response?.status !== 404,
  });
}
