import { useState, useRef, useEffect } from 'react';
import PromptChips from './PromptChips';

interface Message {
  role: 'user' | 'ai';
  text: string;
  question?: string;
  isRateLimited?: boolean;
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
  const [ratings, setRatings] = useState<Record<number, 'up' | 'down'>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  async function sendMessage(question: string) {
    if (!question.trim() || loading) return;
    setInput('');
    const updatedMessages = [...messages, { role: 'user' as const, text: question }];
    setMessages(updatedMessages);
    setLoading(true);

    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.text,
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/weather/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, question, history }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.status === 429 && data.error === 'rate_limited') {
        setMessages(prev => [
          ...prev,
          { role: 'ai', text: data.message ?? "AI is taking a breather — try again in a minute.", isRateLimited: true },
        ]);
      } else {
        const text = res.ok ? data.answer : (data.error ?? 'Something went wrong.');
        setMessages(prev => [...prev, { role: 'ai', text, question }]);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev => [
          ...prev,
          { role: 'ai', text: 'Sorry, AI is unavailable right now.' },
        ]);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }

  function rateMessage(index: number, rating: 'up' | 'down', msg: Message) {
    setRatings(prev => ({ ...prev, [index]: rating }));
    fetch('/api/weather/ai-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, question: msg.question ?? '', answer: msg.text, rating }),
    }).catch(() => {});
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-white/15 rounded-t-2xl shadow-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[75vh] sm:max-h-[60vh] flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-white">Ask WeatherWise AI</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 text-lg leading-none transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 mb-3">
          {messages.length === 0 && (
            <PromptChips prompts={SUGGESTED_PROMPTS} onSelect={sendMessage} />
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl px-4 py-2 max-w-[85%] text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : msg.isRateLimited
                    ? 'bg-amber-500/15 border border-amber-400/30 text-amber-300'
                    : 'bg-white/10 border border-white/10 text-white/85'
              }`}>
                {msg.isRateLimited && <span className="mr-1">⚡</span>}
                {msg.text}
              </div>
              {msg.role === 'ai' && (
                <div className="flex gap-1 mt-1 ml-1">
                  <button
                    onClick={() => rateMessage(i, 'up', msg)}
                    title="This was helpful"
                    className={`text-sm px-1.5 py-0.5 rounded transition-colors ${
                      ratings[i] === 'up' ? 'text-emerald-400' : 'text-white/30 hover:text-emerald-400'
                    }`}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => rateMessage(i, 'down', msg)}
                    title="This wasn't helpful"
                    className={`text-sm px-1.5 py-0.5 rounded transition-colors ${
                      ratings[i] === 'down' ? 'text-red-400' : 'text-white/30 hover:text-red-400'
                    }`}
                  >
                    👎
                  </button>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/8 border border-white/10 rounded-2xl px-4 py-2 text-sm text-white/50">Thinking…</div>
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
            className="flex-1 border border-white/15 rounded-full px-4 py-2 text-sm text-white bg-white/8 placeholder:text-white/30 outline-none focus:ring-2 focus:ring-blue-400/50"
          />
          {loading ? (
            <button
              onClick={stopGeneration}
              className="bg-white/10 border border-white/15 text-white/70 rounded-full px-4 py-2 text-sm hover:bg-white/15 transition"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="bg-blue-500 text-white rounded-full px-4 py-2 text-sm disabled:opacity-40 hover:bg-blue-600 transition"
            >
              Ask
            </button>
          )}
        </div>
      </div>
    </>
  );
}
