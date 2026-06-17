import { useState } from 'react';

interface Props {
  city: string;
}

type Status = 'idle' | 'loading' | 'subscribed' | 'unsubscribed' | 'error';

const STORAGE_KEY = 'ww-digest-email';

export default function DigestSubscribe({ city }: Props) {
  const [email, setEmail] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [expanded, setExpanded] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);

  async function subscribe() {
    if (!email.trim() || !email.includes('@')) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/weather/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), city }),
      });
      if (!res.ok) throw new Error('Failed');
      localStorage.setItem(STORAGE_KEY, email.trim());
      setStatus('subscribed');
    } catch {
      setStatus('error');
    }
  }

  async function unsubscribe() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    setUnsubscribing(true);
    try {
      const res = await fetch('/api/weather/digest/unsubscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: stored }),
      });
      if (!res.ok) throw new Error('Failed');
      localStorage.removeItem(STORAGE_KEY);
      setEmail('');
      setStatus('unsubscribed');
    } catch {
      setStatus('error');
    } finally {
      setUnsubscribing(false);
    }
  }

  if (!expanded && status === 'idle' && !localStorage.getItem(STORAGE_KEY)) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
      >
        <span>📬</span>
        <span>Get a daily weather digest email</span>
      </button>
    );
  }

  const storedEmail = localStorage.getItem(STORAGE_KEY);
  if (status === 'subscribed' || (status === 'idle' && !!storedEmail)) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-400/8 border border-emerald-400/15 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">📬</span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-300">Daily digest active</p>
            <p className="text-xs text-white/40 truncate">
              Sending to {storedEmail} · 6:00 AM daily for {city}
            </p>
          </div>
        </div>
        <button
          onClick={unsubscribe}
          disabled={unsubscribing}
          className="text-xs text-white/30 hover:text-red-400 transition-colors shrink-0 disabled:opacity-50"
        >
          Unsubscribe
        </button>
      </div>
    );
  }

  if (status === 'unsubscribed') {
    return (
      <p className="text-xs text-white/40">
        Unsubscribed from daily digest.{' '}
        <button onClick={() => setStatus('idle')} className="text-blue-400 hover:underline">Re-subscribe</button>
      </p>
    );
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">📬</span>
        <div>
          <p className="text-xs font-medium text-white/70">Daily Digest Email</p>
          <p className="text-xs text-white/35">Get a morning summary for {city} at 6:00 AM</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && subscribe()}
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white/80 text-xs placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={subscribe}
          disabled={status === 'loading' || !email.trim()}
          className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? '…' : 'Subscribe'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-xs text-red-400">Something went wrong. Try again.</p>
      )}
      <button
        onClick={() => setExpanded(false)}
        className="text-xs text-white/25 hover:text-white/40 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
