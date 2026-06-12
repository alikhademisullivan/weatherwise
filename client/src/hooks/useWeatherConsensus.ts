import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { WeatherResponse, ForecastResponse, HourlyForecastResponse, AccuracyResponse } from '../types/weather';

export function useCurrentWeather(city: string) {
  return useQuery<WeatherResponse>({
    queryKey: ['weather', 'current', city],
    queryFn: async () => {
      const { data } = await axios.get<WeatherResponse>('/api/weather/current', {
        params: { city },
      });
      return data;
    },
    enabled: city.trim().length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

export function useForecast(city: string, days: number = 7) {
  return useQuery<ForecastResponse>({
    queryKey: ['weather', 'forecast', city, days],
    queryFn: async () => {
      const { data } = await axios.get<ForecastResponse>('/api/weather/forecast', {
        params: { city, days },
      });
      return data;
    },
    enabled: city.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useHourlyForecast(city: string) {
  return useQuery<HourlyForecastResponse>({
    queryKey: ['weather', 'hourly', city],
    queryFn: async () => {
      const { data } = await axios.get<HourlyForecastResponse>('/api/weather/hourly', {
        params: { city },
      });
      return data;
    },
    enabled: city.trim().length > 0,
    staleTime: 30 * 60 * 1000,
  });
}

export function useAccuracy(city: string) {
  return useQuery<AccuracyResponse>({
    queryKey: ['weather', 'accuracy', city],
    queryFn: async () => {
      const { data } = await axios.get<AccuracyResponse>('/api/weather/accuracy', {
        params: { city },
      });
      return data;
    },
    enabled: city.trim().length > 0,
    staleTime: 60 * 60 * 1000, // accuracy changes slowly — 1h stale time
  });
}
