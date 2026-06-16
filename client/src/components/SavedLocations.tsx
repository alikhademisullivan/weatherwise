import type { SavedLocation } from '../hooks/useSavedLocations';

interface Props {
  locations: SavedLocation[];
  activeCity: string;
  onSelect: (loc: SavedLocation) => void;
  onRemove: (city: string) => void;
}

export default function SavedLocations({ locations, activeCity, onSelect, onRemove }: Props) {
  if (!locations.length) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-4 py-2 border-b border-white/8 bg-black/15 backdrop-blur-sm">
      <span className="text-white/30 text-xs shrink-0">Saved:</span>
      {locations.map(loc => {
        const isActive = loc.city === activeCity;
        return (
          <span
            key={loc.city}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-blue-500/30 border border-blue-400/40 text-blue-200'
                : 'bg-white/8 border border-white/15 text-white/60 hover:text-white/90 hover:bg-white/12'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(loc)}
              className="max-w-[140px] truncate"
              title={loc.label}
            >
              {loc.label.split(',')[0]}
            </button>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(loc.city); }}
              className="ml-0.5 text-white/40 hover:text-white/80 transition-colors leading-none"
              title="Remove"
              aria-label={`Remove ${loc.label}`}
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
}
