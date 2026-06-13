import { useState } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import type { FeedbackType, FeedbackSummary } from '../types/weather';

interface Props {
  city: string;
  coords?: { lat: number; lon: number } | null;
  summary?: (FeedbackSummary & { city: string }) | null;
}

const FEEDBACK_OPTIONS: { type: FeedbackType; label: string; emoji: string }[] = [
  { type: 'accurate',    label: 'Spot on',      emoji: '✅' },
  { type: 'too_warm',   label: 'Too warm',      emoji: '🔥' },
  { type: 'too_cold',   label: 'Too cold',      emoji: '🥶' },
  { type: 'missed_rain', label: 'Missed rain',  emoji: '🌧️' },
  { type: 'false_rain', label: 'No rain came',  emoji: '🌤️' },
];

export default function LocationFeedback({ city, coords, summary }: Props) {
  const [selected, setSelected] = useState<FeedbackType | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // Auto-open when there are no reports yet — lower barrier for first submission
  const [isOpen, setIsOpen] = useState(!summary || summary.total === 0);
  const qc = useQueryClient();

  const handleFeedback = async (type: FeedbackType) => {
    setSelected(type);
    try {
      await axios.post('/api/weather/feedback', {
        city,
        lat: coords?.lat ?? null,
        lon: coords?.lon ?? null,
        type,
      });
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ['weather', 'feedback-summary', city] });
    } catch {
      // Silently fail — feedback is best-effort
      setSubmitted(true);
    }
  };

  const hasInsight = summary && summary.total >= 5 && summary.insight;
  const isFirstReport = !summary || summary.total === 0;

  return (
    <div className="rounded-2xl bg-white/8 border border-white/15 backdrop-blur-sm px-4 py-3 space-y-3">
      {/* Insight banner */}
      {hasInsight && (
        <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-400/20 rounded-xl px-3 py-2">
          <span className="text-sm mt-0.5">🧠</span>
          <div>
            <p className="text-blue-200 text-xs font-medium">{summary.insight}</p>
            <p className="text-blue-400/50 text-xs mt-0.5">Based on {summary.total} feedback{summary.total !== 1 ? 's' : ''} in the past 30 days</p>
          </div>
        </div>
      )}

      {/* "Be first to report" call-to-action */}
      {isFirstReport && (
        <div className="flex items-start gap-2 bg-emerald-500/8 border border-emerald-400/15 rounded-xl px-3 py-2">
          <span className="text-sm mt-0.5">📍</span>
          <div>
            <p className="text-emerald-300/80 text-xs font-medium">Be the first to report for {city}</p>
            <p className="text-emerald-400/40 text-xs mt-0.5">Your feedback helps correct forecasts for everyone in your area</p>
          </div>
        </div>
      )}

      {/* Feedback prompt */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/60 text-sm font-medium">Was today's forecast accurate for {city}?</p>
          {summary && summary.total > 0 && !hasInsight && (
            <p className="text-white/25 text-xs mt-0.5">{summary.total} report{summary.total !== 1 ? 's' : ''} collected</p>
          )}
        </div>
        <button
          onClick={() => setIsOpen(v => !v)}
          className="text-xs text-white/40 hover:text-white/60 transition-colors flex items-center gap-1"
        >
          Give feedback
          <span className="text-white/25">{isOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {isOpen && (
        <>
          {submitted ? (
            <div className="flex items-center gap-2 py-2 justify-center">
              <span className="text-lg">{FEEDBACK_OPTIONS.find(f => f.type === selected)?.emoji}</span>
              <p className="text-white/60 text-sm">
                Thanks! Marked as <span className="text-white/80 font-medium">{FEEDBACK_OPTIONS.find(f => f.type === selected)?.label}</span>.
              </p>
              <button
                onClick={() => { setSubmitted(false); setSelected(null); }}
                className="text-xs text-white/30 hover:text-white/50 ml-2 transition-colors"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_OPTIONS.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => handleFeedback(opt.type)}
                  disabled={submitted}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selected === opt.type
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70 hover:border-white/20'
                  }`}
                >
                  <span>{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Aggregate breakdown */}
          {summary && summary.total >= 3 && (
            <div className="grid grid-cols-5 gap-1 pt-1">
              {FEEDBACK_OPTIONS.map(opt => {
                const count = (summary[opt.type as keyof FeedbackSummary] as number) ?? 0;
                const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
                return (
                  <div key={opt.type} className="flex flex-col items-center gap-1" title={`${opt.label}: ${count} (${pct}%)`}>
                    <div className="h-8 w-full bg-white/5 rounded-sm overflow-hidden flex items-end">
                      <div
                        className="w-full bg-white/20 rounded-sm transition-all"
                        style={{ height: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                    <span className="text-xs">{opt.emoji}</span>
                    <span className="text-white/25 text-xs">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
