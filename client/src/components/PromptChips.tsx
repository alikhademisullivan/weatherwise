interface Props {
  prompts: string[];
  onSelect: (prompt: string) => void;
}

export default function PromptChips({ prompts, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2 py-2">
      {prompts.map((p, i) => (
        <button
          key={i}
          onClick={() => onSelect(p)}
          className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-3 py-2 hover:bg-blue-100 transition"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
