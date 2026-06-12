import { useState, FormEvent } from 'react';

interface Props {
  onSearch: (city: string) => void;
  initialValue?: string;
}

export default function SearchBar({ onSearch, initialValue = '' }: Props) {
  const [input, setInput] = useState(initialValue);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) onSearch(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl mx-auto">
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Search city (e.g. Toronto, London, Tokyo)..."
        className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 backdrop-blur-sm text-sm"
      />
      <button
        type="submit"
        className="px-5 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-medium text-sm transition-colors"
      >
        Search
      </button>
    </form>
  );
}
