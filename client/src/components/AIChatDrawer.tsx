import { useState, useRef, useEffect } from 'react';
import PromptChips from './PromptChips';

interface Message {
  role: 'user' | 'ai';
  text: string;
}

interface Props {
  city: string;
  isOpen: boolean;
  onClose: () => void;
}

const SUGGESTED_PROMPTS = [
  'Should I bring an umbrella today?',
  'Good day for a run?',
  'Best day this week for outdoor plans?',
  'How confident are sources about this weekend?',
];

export default function AIChatDrawer({ city, isOpen, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(question: string) {
    if (!question.trim() || loading) return;
    setInput('');
    const updatedMessages = [...messages, { role: 'user' as const, text: question }];
    setMessages(updatedMessages);
    setLoading(true);

    // Build history from prior exchanges (exclude the question we just added)
    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.text,
    }));

    try {
      const res = await fetch('/api/weather/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, question, history }),
      });
      const data = await res.json();
      const text = res.ok ? data.answer : (data.error ?? 'Something went wrong.');
      setMessages(prev => [...prev, { role: 'ai', text }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: 'Sorry, AI is unavailable right now.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl p-4 max-h-[60vh] flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800">Ask WeatherWise AI</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 && (
          <PromptChips prompts={SUGGESTED_PROMPTS} onSelect={sendMessage} />
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-2xl px-4 py-2 max-w-[85%] text-sm ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-2 text-sm text-gray-400">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder="Ask about today's weather…"
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="bg-blue-500 text-white rounded-full px-4 py-2 text-sm disabled:opacity-40 hover:bg-blue-600 transition"
        >
          Ask
        </button>
      </div>
    </div>
  );
}
