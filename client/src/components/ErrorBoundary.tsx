import React from 'react';

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; error?: Error; }

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('WeatherWise component error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-xl bg-red-950/40 border border-red-800/40 p-4 text-sm text-red-300">
          <p className="font-semibold mb-1">Something went wrong loading this section.</p>
          <p className="text-red-400/70">The rest of the app is still working.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-xs underline text-red-400 hover:text-red-200"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
