import { useState, useCallback } from 'react';
import axios from 'axios';

interface LocationState {
  loading: boolean;
  error: string | null;
}

export function useLocation(onCity: (city: string) => void) {
  const [state, setState] = useState<LocationState>({ loading: false, error: null });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ loading: false, error: 'Geolocation is not supported by your browser.' });
      return;
    }

    setState({ loading: true, error: null });

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { data } = await axios.get<{ city: string }>('/api/weather/geocode/reverse', {
            params: { lat: coords.latitude, lon: coords.longitude },
          });
          onCity(data.city);
          setState({ loading: false, error: null });
        } catch {
          setState({ loading: false, error: 'Could not resolve your location to a city.' });
        }
      },
      () => {
        setState({ loading: false, error: 'Location access was denied.' });
      },
      { timeout: 8000 },
    );
  }, [onCity]);

  return { locate, ...state };
}
