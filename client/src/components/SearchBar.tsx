import { useState, useRef, useEffect, FormEvent } from 'react';
import axios from 'axios';

interface Suggestion {
  label: string;
  city: string;
  lat: number;
  lon: number;
}

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  onSearch: (city: string, coords?: { lat: number; lon: number }) => void;
  onLocate: () => void;
  locating: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export default function SearchBar({ value, onValueChange, onSearch, onLocate, locating, inputRef }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = inputRef ?? internalInputRef;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(v: string) {
    onValueChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await axios.get<{ results: Suggestion[] }>('/api/weather/geocode/search', {
          params: { q: v.trim() },
        });
        setSuggestions(data.results);
        setOpen(data.results.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 300);
  }

  function handleSelect(s: Suggestion) {
    onValueChange(s.label);
    setSuggestions([]);
    setOpen(false);
    onSearch(s.label, { lat: s.lat, lon: s.lon });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setOpen(false);
    if (suggestions.length > 0) {
      handleSelect(suggestions[0]);
    } else {
      onSearch(trimmed);
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={resolvedInputRef}
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && setOpen(false)}
          placeholder="Search city (e.g. Toronto, London, Tokyo)..."
          className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur-sm text-sm"
        />
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          title="Use my location"
          className="hidden sm:flex px-3 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl transition-colors disabled:opacity-50 items-center justify-center"
        >
          {locating ? <span className="animate-spin inline-block">⟳</span> : '📍'}
        </button>
        <button
          type="submit"
          className="px-3 sm:px-5 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-medium text-sm transition-colors"
        >
          <span className="sm:hidden">🔍</span>
          <span className="hidden sm:inline">Search</span>
        </button>
      </form>

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full mt-1 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden shadow-xl">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
                className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-colors"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
