import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const TECH = [
  'React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL',
  'Tailwind CSS', 'Recharts', 'Leaflet', 'TanStack Query',
  'Groq / LLaMA 3.3 70B', 'Open-Meteo', 'OpenWeatherMap',
  'Tomorrow.io', 'WeatherAPI', 'Vite', 'PWA',
];

const HOW_IT_WORKS = [
  {
    icon: '🌐',
    title: 'Multi-Source Consensus',
    desc: "Aggregates four independent weather APIs into a single weighted reading, with each source's accuracy tracked over 30 days.",
  },
  {
    icon: '⚠️',
    title: 'Forecast Dispute Detection',
    desc: 'When sources spread more than 3°C apart, a dispute badge surfaces so you know the forecast is uncertain before you rely on it.',
  },
  {
    icon: '🏆',
    title: 'Source Scorecard',
    desc: 'Tracks which provider has been most accurate in your specific city and automatically weights them higher in the consensus.',
  },
  {
    icon: '🤖',
    title: 'AI Weather Chat',
    desc: 'Ask anything in plain English. The AI answers from your live forecast data and 7-day outlook — not generic advice.',
  },
];

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  );
}

export default function AboutPage() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className={`transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="max-w-[720px] mx-auto px-4 py-10 pb-20 space-y-12">

        {/* Back nav */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          <span aria-hidden="true">←</span> Back to forecast
        </Link>

        {/* ── Hero ── */}
        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm px-8 py-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">WeatherWise</h1>
          <p className="mt-3 text-white/50 text-base leading-relaxed max-w-sm mx-auto">
            The weather app that tells you when to trust the forecast.
          </p>
        </div>

        {/* ── Why I Built This ── */}
        <section className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm px-8 py-8">
          <h2 className="text-lg font-semibold text-white mb-4">Why I Built This</h2>
          <div className="space-y-4 text-white/60 text-sm leading-relaxed">
            <p>
              I got tired of checking three different weather apps before leaving the house
              and getting three different answers. Most apps show you a confident number
              with no indication of how reliable it actually is.
            </p>
            <p>
              WeatherWise pulls from four independent sources — Open-Meteo, OpenWeatherMap,
              Tomorrow.io, and WeatherAPI — computes a weighted consensus, and tells you
              explicitly when they disagree. Because a forecast you can't trust isn't
              a forecast, it's a guess.
            </p>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HOW_IT_WORKS.map(item => (
              <div
                key={item.title}
                className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm px-5 py-5 flex gap-4"
              >
                <span className="text-2xl shrink-0 leading-none mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-white/80 font-medium text-sm mb-1">{item.title}</p>
                  <p className="text-white/45 text-xs leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tech Stack ── */}
        <section className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm px-8 py-8">
          <h2 className="text-lg font-semibold text-white mb-5">Built With</h2>
          <div className="flex flex-wrap gap-2">
            {TECH.map(t => (
              <span
                key={t}
                className="text-xs font-medium text-white/60 bg-white/8 border border-white/10 rounded-full px-3 py-1"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* ── About the Developer ── */}
        <section className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm px-8 py-8">
          <h2 className="text-lg font-semibold text-white mb-4">About the Developer</h2>
          <div className="space-y-4 text-white/60 text-sm leading-relaxed">
            <p>
              Built by Ali Khademi Sullivan — a Software Engineering graduate from
              Western University (BESc, Class of 2026).
            </p>
            <p>
              WeatherWise started as a side project to explore multi-source data
              aggregation, AI-grounded chat, and what a weather app could look like
              if it prioritized transparency over false confidence.
            </p>
          </div>

          <div className="flex items-center gap-4 mt-6">
            <a
              href="https://github.com/alikhademisullivan"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
              className="text-white/40 hover:text-white transition-colors"
            >
              <GitHubIcon />
            </a>
            <a
              href="#"
              title="LinkedIn"
              className="text-white/40 hover:text-white transition-colors"
            >
              <LinkedInIcon />
            </a>
            <a
              href="mailto:sullivanali03@gmail.com"
              title="Email"
              className="text-white/40 hover:text-white transition-colors"
            >
              <EmailIcon />
            </a>
          </div>
        </section>

        {/* ── Privacy ── */}
        <section className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm px-8 py-8">
          <h2 className="text-lg font-semibold text-white mb-4">Privacy</h2>
          <div className="space-y-3 text-white/55 text-sm leading-relaxed">
            <p>
              WeatherWise does not sell your data and does not show ads.
            </p>
            <ul className="space-y-2 list-none">
              <li className="flex gap-2"><span className="text-white/30 shrink-0">·</span><span><strong className="text-white/70">Location</strong> — used only to fetch your local forecast. Never stored on our servers without your explicit sign-in.</span></li>
              <li className="flex gap-2"><span className="text-white/30 shrink-0">·</span><span><strong className="text-white/70">AI chat</strong> — messages are sent to Groq (LLaMA) to generate responses. Do not include personal or sensitive information.</span></li>
              <li className="flex gap-2"><span className="text-white/30 shrink-0">·</span><span><strong className="text-white/70">Analytics</strong> — optional, anonymised page-view data via PostHog (only active when a key is configured).</span></li>
              <li className="flex gap-2"><span className="text-white/30 shrink-0">·</span><span><strong className="text-white/70">Preferences</strong> — temperature unit, commute times, and last searched city are stored locally in your browser only.</span></li>
            </ul>
          </div>
        </section>

        {/* ── Footer ── */}
        <p className="text-center text-white/25 text-xs">
          WeatherWise · Free · No ads · No account required ·{' '}
          <a
            href="https://github.com/alikhademisullivan"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/50 transition-colors"
          >
            Open source
          </a>
        </p>

      </div>
    </div>
  );
}
