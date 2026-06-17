import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export interface SavedLocation {
  label: string;
  city: string;
  lat: number | null;
  lon: number | null;
}

const KEY = 'ww_saved_locations';

function loadLocal(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistLocal(locs: SavedLocation[]) {
  localStorage.setItem(KEY, JSON.stringify(locs));
}

export function useSavedLocations() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<SavedLocation[]>(loadLocal);

  // Reload from API when auth state changes
  useEffect(() => {
    if (user) {
      axios.get<{ locations: SavedLocation[] }>('/api/auth/locations')
        .then(r => setLocations(r.data.locations))
        .catch(() => {});
    } else {
      setLocations(loadLocal());
    }
  }, [user]);

  const save = useCallback(async (loc: SavedLocation) => {
    if (user) {
      await axios.post('/api/auth/locations', loc).catch(() => {});
      setLocations(prev => prev.some(p => p.city === loc.city) ? prev : [...prev, loc]);
    } else {
      setLocations(prev => {
        if (prev.some(p => p.city === loc.city)) return prev;
        const next = [...prev, loc];
        persistLocal(next);
        return next;
      });
    }
  }, [user]);

  const remove = useCallback(async (city: string) => {
    if (user) {
      await axios.delete(`/api/auth/locations/${encodeURIComponent(city)}`).catch(() => {});
      setLocations(prev => prev.filter(p => p.city !== city));
    } else {
      setLocations(prev => {
        const next = prev.filter(p => p.city !== city);
        persistLocal(next);
        return next;
      });
    }
  }, [user]);

  const isSaved = useCallback((city: string) => locations.some(p => p.city === city), [locations]);

  return { locations, save, remove, isSaved };
}
