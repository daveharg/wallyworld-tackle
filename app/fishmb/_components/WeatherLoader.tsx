"use client";

/** Modern weather loading indicator — animated sun/cloud with shimmer. */
export default function WeatherLoader({ label = "Loading weather…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      {/* Animated weather scene */}
      <div className="relative w-32 h-32">
        {/* Sun */}
        <div className="absolute top-2 left-4 w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 shadow-[0_0_30px_rgba(251,191,36,0.5)] animate-[weather-sun_3s_ease-in-out_infinite]" />
        {/* Cloud */}
        <div className="absolute bottom-4 right-2 animate-[weather-drift_4s_ease-in-out_infinite]">
          <div className="relative">
            <div className="w-20 h-8 bg-white rounded-full shadow-lg" />
            <div className="absolute -top-4 left-3 w-10 h-10 bg-white rounded-full" />
            <div className="absolute -top-3 left-9 w-8 h-8 bg-white rounded-full" />
          </div>
        </div>
        {/* Rain drops */}
        <div className="absolute bottom-0 left-8 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1 h-3 rounded-full bg-sky-400 animate-[weather-rain_1.2s_ease-in_infinite]"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          ))}
        </div>
      </div>

      {/* Shimmer bar */}
      <div className="w-48 h-2 rounded-full bg-pine/10 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-signal to-transparent animate-[weather-shimmer_1.5s_ease-in-out_infinite]" />
      </div>

      {label && <p className="text-sm font-bold text-pine/50 tracking-wide">{label}</p>}

      <style jsx>{`
        @keyframes weather-sun {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.85; }
        }
        @keyframes weather-drift {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-8px); }
        }
        @keyframes weather-rain {
          0% { transform: translateY(0); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translateY(16px); opacity: 0; }
        }
        @keyframes weather-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
