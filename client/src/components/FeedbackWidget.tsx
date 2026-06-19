import { useState } from 'react';
import axios from 'axios';

type Category = 'bug' | 'feature' | 'general' | 'compliment';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'bug', label: 'Bug report' },
  { value: 'feature', label: 'Feature request' },
  { value: 'compliment', label: 'Compliment' },
];

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [category, setCategory] = useState<Category>('general');
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function submit() {
    if (!rating) return;
    setStatus('loading');
    try {
      await axios.post('/api/weather/user-feedback', { rating, category, comment, email: email || undefined });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  function reset() {
    setRating(0);
    setHovered(0);
    setCategory('general');
    setComment('');
    setEmail('');
    setStatus('idle');
    setOpen(false);
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-3 sm:bottom-6 sm:left-6 bg-white/10 hover:bg-white/15 border border-white/15 text-white/70 hover:text-white rounded-full shadow-lg transition-colors z-40 backdrop-blur-sm flex items-center justify-center h-11 w-11 sm:h-auto sm:w-auto sm:px-4 sm:py-2.5"
        aria-label="Share feedback"
      >
        <span className="sm:hidden text-sm leading-none">★</span>
        <span className="hidden sm:inline text-xs font-medium">Feedback</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={reset}>
          <div
            className="w-full max-w-sm bg-[#0f1f3d] border border-white/15 rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {status === 'done' ? (
              <div className="text-center py-4 space-y-2">
                <div className="text-3xl">🙏</div>
                <p className="text-white font-semibold">Thanks for your feedback!</p>
                <p className="text-white/50 text-sm">It genuinely helps make WeatherWise better.</p>
                <button onClick={reset} className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline">Close</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold text-base">Share Feedback</h2>
                  <button onClick={reset} className="text-white/30 hover:text-white/60 text-lg leading-none">×</button>
                </div>

                {/* Star rating */}
                <div>
                  <p className="text-white/50 text-xs mb-2">How's your experience?</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onMouseEnter={() => setHovered(n)}
                        onMouseLeave={() => setHovered(0)}
                        onClick={() => setRating(n)}
                        className="text-2xl transition-transform hover:scale-110"
                      >
                        {n <= (hovered || rating) ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setCategory(c.value)}
                      className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                        category === c.value
                          ? 'bg-blue-500/25 border-blue-400/50 text-blue-300'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Comment */}
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="What's on your mind? (optional)"
                  rows={3}
                  maxLength={2000}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-blue-400/50"
                />

                {/* Email */}
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email for follow-up (optional)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-400/50"
                />

                {status === 'error' && (
                  <p className="text-red-400 text-xs">Something went wrong — try again.</p>
                )}

                <button
                  onClick={submit}
                  disabled={!rating || status === 'loading'}
                  className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {status === 'loading' ? 'Sending…' : 'Submit feedback'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
