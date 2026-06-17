import { useState } from 'react';

export interface SavedLocation {
  label: string;
  city: string;
  lat: number | null;
  lon: number | null;
}

const KEY = 'ww_saved_locations';

function load(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(locs: SavedLocation[]) {
  localStorage.setItem(KEY, JSON.stringify(locs));
}

export function useSavedLocations() {
  const [locations, setLocations] = useState<SavedLocation[]>(load);

  function save(loc: SavedLocation) {
    setLocations(prev => {
      if (prev.some(p => p.city === loc.city)) return prev;
      const next = [...prev, loc];
      persist(next);
      return next;
    });
  }

  function remove(city: string) {
    setLocations(prev => {
      const next = prev.filter(p => p.city !== city);
      persist(next);
      return next;
    });
  }

  function isSaved(city: string) {
    return locations.some(p => p.city === city);
  }

  return { locations, save, remove, isSaved };
}
