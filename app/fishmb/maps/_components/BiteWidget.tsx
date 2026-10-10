// Fish bite prediction widget — scores current fishing quality 0-100
// from barometric pressure and trend (same logic as the weather page).

"use client";

import { useEffect, useState } from "react";

function hourScore(pressure: number, trend3h: number): number {
  let s = 50;
  if (pressure >= 1009 && pressure <= 1022) s += 25;
  else if (pressure >= 1005 && pressure <= 1026) s += 10;
  else if (pressure > 1030 || pressure < 1000) s -= 20;
  if (trend3h <= -2) s += 20;
  else if (trend3h <= -1) s += 10;
  else if (trend3h >= 2) s -= 10;
  return Math.max(0, Math.min(100, s));
}

function scoreLabel(s: number): { label: string; color: string } {
  if (s >= 70) return { label: "Good", color: "#22c55e" };
  if (s >= 50) return { label: "Fair", color: "#84cc16" };
  if (s >= 35) return { label: "Slow", color: "#f59e0b" };
  return { label: "Tough", color: "#ef4444" };
}

export default function BiteWidget({ lat, lng }: { lat: number; lng: number }) {
  const [bite, setBite] = useState<{ score: number; label: string; color: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
            3
          )}&longitude=${lng.toFixed(3)}&hourly=pressure_msl&current=pressure_msl&timezone=auto&forecast_days=2`
        );
        const d = await r.json();
        const now = d?.current?.pressure_msl;
        const hours: number[] = d?.hourly?.pressure_msl ?? [];
        const times: string[] = d?.hourly?.time ?? [];
        if (!Number.isFinite(now) || hours.length === 0) return;
        // Find the index closest to now, then the pressure ~3h ago.
        const nowMs = Date.now();
        let best = 0;
        let bestDiff = Infinity;
        times.forEach((tstr, i) => {
          const diff = Math.abs(new Date(tstr).getTime() - nowMs);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = i;
          }
        });
        const past = hours[Math.max(0, best - 3)] ?? hours[0];
        const trend = now - past;
        const score = hourScore(now, trend);
        const { label, color } = scoreLabel(score);
        if (!cancelled) setBite({ score: Math.round(score), label, color });
      } catch {
        // Bite stays hidden on failure.
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [lat, lng]);

  if (!bite) return null;

  return (
    <div className="bg-white/95 backdrop-blur border border-pine/15 rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={bite.color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6.5 12c2-4.5 5-6.5 8.5-6.5 3 0 5.5 2.5 6 6-.5 3.5-3 6-6 6-3.5 0-6.5-2-8.5-6.5z" />
        <path d="M6.5 12 3 9.5M6.5 12 3 14.5" />
        <circle cx="16.5" cy="11" r="1" fill={bite.color} />
      </svg>
      <span className="text-xs font-black tabular-nums whitespace-nowrap" style={{ color: bite.color }}>
        Bite: {bite.label}
      </span>
    </div>
  );
}
