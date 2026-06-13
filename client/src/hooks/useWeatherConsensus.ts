import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { WeatherResponse, ForecastResponse, HourlyForecastResponse, AccuracyResponse, AlertsResponse, FeedbackSummary } from '../types/weather';

type Coords = { lat: number; lon: number } | null | undefined;

function coordsParams(coords: Coords) {
  return coords ? { lat: coords.lat, lon: coords.lon } : {};
}

export function useCurrentWeather(city: string, coords?: Coords) {
  return useQuery<WeatherResponse>({
    queryKey: ['weather', 'current', city, coords?.lat, coords?.lon],
    queryFn: async () => {
      const { data } = await axios.get<WeatherResponse>('/api/weather/current', {
        params: { city, ...coordsParams(coords) },
      });
      return data;
    },
    enabled: city.trim().length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

export function useForecast(city: string, coords?: Coords, days: number = 7) {
  return useQuery<ForecastResponse>({
    queryKey: ['weather', 'forecast', city, coords?.lat, coords?.lon, days],
    queryFn: async () => {
      const { data } = await axios.get<ForecastResponse>('/api/weather/forecast', {
        params: { city, days, ...coordsParams(coords) },
      });
      return data;
    },
    enabled: city.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useHourlyForecast(city: string, coords?: Coords) {
  return useQuery<HourlyForecastResponse>({
    queryKey: ['weather', 'hourly', city, coords?.lat, coords?.lon],
    queryFn: async () => {
      const { data } = await axios.get<HourlyForecastResponse>('/api/weather/hourly', {
        params: { city, ...coordsParams(coords) },
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
    staleTime: 60 * 60 * 1000,
  });
}

export function useAlerts(city: string, coords?: Coords) {
  return useQuery<AlertsResponse>({
    queryKey: ['weather', 'alerts', city, coords?.lat, coords?.lon],
    queryFn: async () => {
      const { data } = await axios.get<AlertsResponse>('/api/weather/alerts', {
        params: { city, ...coordsParams(coords) },
      });
      return data;
    },
    enabled: city.trim().length > 0,
    staleTime: 15 * 60 * 1000,
  });
}

export function useFeedbackSummary(city: string) {
  return useQuery<FeedbackSummary & { city: string }>({
    queryKey: ['weather', 'feedback-summary', city],
    queryFn: async () => {
      const { data } = await axios.get('/api/weather/feedback-summary', { params: { city } });
      return data;
    },
    enabled: city.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
