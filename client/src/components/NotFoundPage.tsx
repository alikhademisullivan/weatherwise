import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <div className="text-6xl">🌫️</div>
        <h1 className="text-2xl font-bold text-white">Page not found</h1>
        <p className="text-white/50 text-sm max-w-xs mx-auto">
          Looks like this page drifted off. The forecast is only available on the home page.
        </p>
        <Link
          to="/"
          className="inline-block mt-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Back to WeatherWise
        </Link>
      </div>
    </div>
  );
}
