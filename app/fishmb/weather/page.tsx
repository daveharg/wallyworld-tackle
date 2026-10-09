"use client";

import { useEffect, useMemo, useState } from "react";
import LocationPicker, { WxLoc } from "./_components/LocationPicker";

/* ------------------------------------------------------------------ */
/* WMO weather-code → label + emoji                                     */
/* ------------------------------------------------------------------ */
function wmo(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear sky", icon: "☀️" };
  if (code === 1) return { label: "Mostly clear", icon: "🌤️" };
  if (code === 2) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "🌨️" };
  if (code >= 80 && code <= 82) return { label: "Showers", icon: "🌦️" };
  if (code === 85 || code === 86) return { label: "Snow showers", icon: "🌨️" };
  if (code >= 95) return { label: "Thunderstorm", icon: "⛈️" };
  return { label: "—", icon: "🌡️" };
}

function compass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

type Current = {
  temperature_2m: number;
  apparent_temperature: number;
  weather_code: number;
  cloud_cover: number;
  pressure_msl: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
  relative_humidity_2m: number;
  time: string;
};

type WxData = {
  current: Current;
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; pressure_msl: number[]; weather_code: number[] };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    wind_speed_10m_max: number[];
  };
};

const DEFAULT_COORDS = { lat: 49.9, lon: -97.14, label: "Winnipeg area" };
const CURRENT_KEY = "fishmb-wx-current";

function loadCurrent(): { lat: number; lon: number; label: string } {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (typeof c.lat === "number" && typeof c.lon === "number") {
        return { lat: c.lat, lon: c.lon, label: typeof c.label === "string" ? c.label : "Saved spot" };
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_COORDS;
}

/* ------------------------------------------------------------------ */
/* Pressure gauge (SVG) — ideal fishing band marked                     */
/* ------------------------------------------------------------------ */
function PressureGauge({ value }: { value: number }) {
  const MIN = 980, MAX = 1040;
  const frac = Math.min(1, Math.max(0, (value - MIN) / (MAX - MIN)));
  const angle = 180 - frac * 180; // 180 (left) → 0 (right)
  const cx = 100, cy = 95, r = 78;
  const rad = (a: number) => (a * Math.PI) / 180;
  const pt = (a: number, rr = r) => `${cx + rr * Math.cos(rad(a))},${cy - rr * Math.sin(rad(a))}`;
  const arc = (a0: number, a1: number, rr = r) =>
    `M ${pt(a0, rr)} A ${rr} ${rr} 0 0 1 ${pt(a1, rr)}`;
  // Zones: angle for a pressure value
  const ang = (p: number) => 180 - (Math.min(1, Math.max(0, (p - MIN) / (MAX - MIN))) * 180);
  const zones: [number, number, string][] = [
    [MIN, 1000, "#ef4444"],
    [1000, 1009, "#f59e0b"],
    [1009, 1022, "#22c55e"],
    [1022, 1030, "#f59e0b"],
    [1030, MAX, "#f97316"],
  ];
  return (
    <svg viewBox="0 0 200 115" className="w-full">
      {zones.map(([p0, p1, c], i) => (
        <path key={i} d={arc(ang(p0), ang(p1))} stroke={c} strokeWidth="13" fill="none" strokeLinecap="butt" />
      ))}
      {/* Ideal band label */}
      <text x={cx + 62 * Math.cos(rad(ang(1015.5)))} y={cy - 62 * Math.sin(rad(ang(1015.5))) - 12} textAnchor="middle" fontSize="9" fontWeight="800" fill="#4ade80">
        IDEAL
      </text>
      {/* Needle */}
      <line x1={cx} y1={cy} x2={pt(angle, 62)} stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="7" fill="#ffffff" />
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize="17" fontWeight="900" fill="#ffffff">
        {Math.round(value)}
      </text>
      <text x={cx} y={cy + 34} textAnchor="middle" fontSize="9" fill="#ffffff" opacity="0.65">
        hPa
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Explainers                                                          */
/* ------------------------------------------------------------------ */
const EXPLAINERS: Record<string, { title: string; body: string[] }> = {
  pressure: {
    title: "Barometric pressure",
    body: [
      "Fish feel pressure changes in their swim bladders, and it changes how they feed. The sweet spot is roughly 1009–1022 hPa (the green band on the gauge).",
      "Steady or slowly rising pressure in that band: good, predictable fishing.",
      "Falling pressure: a front is on the way. The hours before it arrives can be the best bite of the week — fish feed hard ahead of the change.",
      "Very high pressure with bluebird skies: often the toughest conditions. Fish go deep or tuck tight to cover; slow down and downsize.",
    ],
  },
  wind: {
    title: "Wind",
    body: [
      "A light chop is your friend: it breaks up light penetration so fish can't see you as well, and it pushes baitfish toward the windward shore — predators follow.",
      "Calm, glassy water on a bright day: spooky fish. Go stealthy, long casts, natural colours.",
      "Strong, gusting wind: fishable from the sheltered side, but watch for whitecaps and cold fronts riding in on a north wind — safety first.",
      "Rule of thumb: fish the windy side of structure. Bait stacks up there.",
    ],
  },
  cloud: {
    title: "Cloud cover",
    body: [
      "Overcast skies are prime time: low light lets walleye and pike roam shallower and feed longer through the day.",
      "Bright sun: fish slide deeper or hug tight cover and shade. Fish the shadows, docks, weed edges and drop-offs.",
      "Partly cloudy with sun breaks: work the transitions — bites often come right as a cloud covers or uncovers the sun.",
    ],
  },
  front: {
    title: "Storm fronts",
    body: [
      "We watch the 3-hour pressure trend. Falling fast = a front is approaching. That's your cue to get on the water now — the pre-front feed can be electric.",
      "During the front (rain, wind shift): the bite usually shuts off. Fish hunker down.",
      "After the front passes, high pressure settles in and fishing can stay tough for 24–48 hours. Fish slow, small and deep until pressure stabilizes.",
    ],
  },
};

function biteOutlook(p: number, trend: number, cloud: number, wind: number): { label: string; color: string; note: string } {
  if (trend <= -2) return { label: "Feeding window", color: "#f59e0b", note: "Pressure falling — front coming. Fish now, the bite may die when it hits." };
  if (p >= 1009 && p <= 1022 && trend >= -0.5 && cloud >= 40)
    return { label: "Good", color: "#22c55e", note: "Pressure in the sweet spot, low light. Fish should be active." };
  if (p >= 1009 && p <= 1022)
    return { label: "Fair", color: "#84cc16", note: "Pressure is fine — bright skies may push fish deeper or tighter to cover." };
  if (p > 1030) return { label: "Tough", color: "#ef4444", note: "Very high pressure, bluebird conditions. Slow down, downsize, fish deep." };
  if (wind >= 40) return { label: "Windy", color: "#f59e0b", note: "Strong wind — fish the sheltered side and watch the whitecaps." };
  return { label: "Unsettled", color: "#f59e0b", note: "Pressure is off the sweet spot. Fish structure and stay adaptable." };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function WeatherPage() {
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [data, setData] = useState<WxData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [explainer, setExplainer] = useState<string | null>(null);

  // Remember the last-viewed spot between visits.
  useEffect(() => {
    setCoords(loadCurrent());
  }, []);

  const pickLoc = (loc: WxLoc) => {
    const next = { lat: loc.lat, lon: loc.lon, label: loc.name };
    setCoords(next);
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(next));
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    let stop = false;
    async function load() {
      setErr(null);
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat.toFixed(3)}&longitude=${coords.lon.toFixed(3)}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
          `&hourly=temperature_2m,precipitation_probability,pressure_msl,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max` +
          `&timezone=auto&forecast_days=7&past_days=1`;
        const r = await fetch(url);
        if (!r.ok) throw new Error("weather request failed");
        const d = (await r.json()) as WxData;
        if (!stop) setData(d);
      } catch {
        if (!stop) setErr("Couldn't load the weather right now. Check your connection and try again.");
      }
    }
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [coords]);

  const derived = useMemo(() => {
    if (!data) return null;
    const c = data.current;
    // 3-hour pressure trend from hourly series (find current hour index)
    let trend = 0;
    try {
      const idx = data.hourly.time.findIndex((t) => t >= c.time.slice(0, 13));
      const i = idx > 0 ? idx : data.hourly.pressure_msl.length - 1;
      const now = data.hourly.pressure_msl[i];
      const then = data.hourly.pressure_msl[Math.max(0, i - 3)];
      trend = now - then;
    } catch {
      trend = 0;
    }
    const outlook = biteOutlook(c.pressure_msl, trend, c.cloud_cover, c.wind_speed_10m);
    const front =
      trend <= -2
        ? { label: "Front approaching", color: "#ef4444", icon: "🌩️" }
        : trend >= 2
          ? { label: "Front passing", color: "#f59e0b", icon: "🌤️" }
          : { label: "Stable", color: "#22c55e", icon: "✅" };
    return { c, trend, outlook, front, wmo: wmo(c.weather_code) };
  }, [data]);

  const windySrc = useMemo(() => {
    const lat = coords.lat.toFixed(2);
    const lon = coords.lon.toFixed(2);
    const p = new URLSearchParams({
      lat,
      lon,
      detailLat: lat,
      detailLon: lon,
      zoom: "7",
      level: "surface",
      overlay: "wind",
      product: "ecmwf",
      menu: "",
      message: "",
      marker: "",
      calendar: "now",
      pressure: "",
      type: "map",
      location: "coordinates",
      detail: "",
      metricWind: "km/h",
      metricTemp: "°C",
      radarRange: "-1",
    });
    return `https://embed.windy.com/embed2.html?${p.toString()}`;
  }, [coords]);

  return (
    <div className="min-h-screen bg-[#0b1a15] text-white pb-32">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#123a2e] via-[#0e2a22] to-[#0b1a15]" />
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative max-w-2xl mx-auto px-5 pt-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setPickerOpen(true)} className="text-left group">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200/60">FishMB Weather</p>
              <h1 className="text-lg font-black">
                📍 {coords.label} <span className="text-white/40 text-sm group-active:text-white/70">▾</span>
              </h1>
            </button>
          </div>

          {err && <p className="mt-6 text-sm text-red-300">{err}</p>}

          {derived ? (
            <>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-7xl font-black tracking-tight">{Math.round(derived.c.temperature_2m)}°</div>
                  <p className="mt-1 text-emerald-100/80 text-sm">
                    {derived.wmo.icon} {derived.wmo.label} · Feels {Math.round(derived.c.apparent_temperature)}°
                  </p>
                </div>
                <div className="text-right text-xs text-emerald-100/70 space-y-1">
                  <p>H {data ? Math.round(data.daily.temperature_2m_max[1] ?? data.daily.temperature_2m_max[0]) : "—"}°</p>
                  <p>L {data ? Math.round(data.daily.temperature_2m_min[1] ?? data.daily.temperature_2m_min[0]) : "—"}°</p>
                  <p>💧 {derived.c.relative_humidity_2m}%</p>
                </div>
              </div>

              {/* Bite outlook banner */}
              <div className="mt-5 rounded-3xl bg-white/[0.07] border border-white/10 p-4 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: derived.outlook.color }} />
                <div>
                  <p className="text-sm font-black">
                    Bite outlook: <span style={{ color: derived.outlook.color }}>{derived.outlook.label}</span>
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">{derived.outlook.note}</p>
                </div>
              </div>
            </>
          ) : (
            !err && <div className="mt-8 h-40 rounded-3xl bg-white/5 animate-pulse" />
          )}
        </div>
      </div>

      {derived && data && (
        <div className="max-w-2xl mx-auto px-5 space-y-4 mt-5">
          {/* Fishing-conditions cards */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setExplainer("pressure")} className="text-left rounded-3xl bg-white/[0.07] border border-white/10 p-4 active:scale-[0.98] transition">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Pressure</p>
              <div className="mt-1 -mb-1"><PressureGauge value={derived.c.pressure_msl} /></div>
              <p className="text-[11px] text-white/60">
                {derived.trend <= -0.5 ? "↘ falling" : derived.trend >= 0.5 ? "↗ rising" : "→ steady"} · {Math.abs(derived.trend).toFixed(1)} hPa/3h
              </p>
              <p className="text-[10px] text-emerald-200/50 mt-1 underline underline-offset-2">How to read it for fishing</p>
            </button>

            <button onClick={() => setExplainer("wind")} className="text-left rounded-3xl bg-white/[0.07] border border-white/10 p-4 active:scale-[0.98] transition">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Wind</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="relative w-14 h-14 rounded-full border border-white/20 shrink-0">
                  <span
                    className="absolute inset-0 flex items-start justify-center text-lg"
                    style={{ transform: `rotate(${derived.c.wind_direction_10m}deg)` }}
                  >
                    <span style={{ transform: "translateY(2px)" }}>➤</span>
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{compass(derived.c.wind_direction_10m)}</span>
                </div>
                <div>
                  <p className="text-2xl font-black">{Math.round(derived.c.wind_speed_10m)}<span className="text-xs font-bold text-white/50"> km/h</span></p>
                  <p className="text-[11px] text-white/60">Gusts {Math.round(derived.c.wind_gusts_10m)} km/h</p>
                </div>
              </div>
              <p className="text-[10px] text-emerald-200/50 mt-2 underline underline-offset-2">How to read it for fishing</p>
            </button>

            <button onClick={() => setExplainer("cloud")} className="text-left rounded-3xl bg-white/[0.07] border border-white/10 p-4 active:scale-[0.98] transition">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Cloud cover</p>
              <p className="text-3xl font-black mt-2">{derived.c.cloud_cover}<span className="text-sm font-bold text-white/50">%</span></p>
              <p className="text-[11px] text-white/60 mt-1">
                {derived.c.cloud_cover >= 70 ? "Overcast — prime low light" : derived.c.cloud_cover >= 30 ? "Partly cloudy — watch the sun breaks" : "Clear — fish shade and depth"}
              </p>
              <p className="text-[10px] text-emerald-200/50 mt-1 underline underline-offset-2">How to read it for fishing</p>
            </button>

            <button onClick={() => setExplainer("front")} className="text-left rounded-3xl bg-white/[0.07] border border-white/10 p-4 active:scale-[0.98] transition">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Storm front</p>
              <p className="text-3xl mt-2">{derived.front.icon}</p>
              <p className="text-sm font-black mt-1" style={{ color: derived.front.color }}>{derived.front.label}</p>
              <p className="text-[11px] text-white/60">3h pressure trend {derived.trend >= 0 ? "+" : ""}{derived.trend.toFixed(1)} hPa</p>
              <p className="text-[10px] text-emerald-200/50 mt-1 underline underline-offset-2">How to read it for fishing</p>
            </button>
          </div>

          {/* Live wind map */}
          <section className="rounded-3xl overflow-hidden border border-white/10 bg-white/[0.05]">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h2 className="text-sm font-black">🌬️ Live wind map</h2>
              <span className="text-[10px] text-white/40">windy.com</span>
            </div>
            <iframe
              title="Live wind map"
              src={windySrc}
              className="w-full h-80 border-0"
              loading="lazy"
              allowFullScreen
            />
            <p className="px-4 py-2.5 text-[11px] text-white/50">
              Live wind over your waters. Zoom in to your lake — fish the windy side of structure where bait stacks up.
            </p>
          </section>

          {/* Hourly */}
          <section className="rounded-3xl bg-white/[0.05] border border-white/10 p-4">
            <h2 className="text-sm font-black mb-3">Next 24 hours</h2>
            <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
              {data.hourly.time.slice(0, 24).map((t, i) => {
                const hr = parseInt(t.slice(11, 13), 10);
                return (
                  <div key={t} className="flex flex-col items-center gap-1 min-w-12 text-center">
                    <span className="text-[10px] text-white/50 font-bold">{i === 0 ? "Now" : `${hr}:00`}</span>
                    <span className="text-lg">{wmo(data.hourly.weather_code[i] ?? 0).icon}</span>
                    <span className="text-xs font-black">{Math.round(data.hourly.temperature_2m[i])}°</span>
                    <span className="text-[10px] text-sky-300/80">{Math.round(data.hourly.precipitation_probability[i] ?? 0)}%</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 7-day */}
          <section className="rounded-3xl bg-white/[0.05] border border-white/10 p-4">
            <h2 className="text-sm font-black mb-2">7-day</h2>
            {data.daily.time.map((t, i) => {
              const d = new Date(t + "T12:00:00");
              const day = i === 0 ? "Today" : d.toLocaleDateString("en-CA", { weekday: "short" });
              const w = wmo(data.daily.weather_code[i]);
              return (
                <div key={t} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                  <span className="w-16 text-xs font-bold text-white/70">{day}</span>
                  <span className="text-lg">{w.icon}</span>
                  <span className="flex-1 text-[11px] text-white/50">{w.label}</span>
                  <span className="text-xs text-white/50">{Math.round(data.daily.temperature_2m_min[i])}°</span>
                  <span className="text-xs font-black w-10 text-right">{Math.round(data.daily.temperature_2m_max[i])}°</span>
                </div>
              );
            })}
          </section>

          <p className="text-[10px] text-white/30 text-center pb-2">
            Weather by Open-Meteo · Wind map by Windy · Always check conditions before heading out
          </p>
        </div>
      )}

      {/* Location picker */}
      {pickerOpen && (
        <LocationPicker
          current={{ name: coords.label, lat: coords.lat, lon: coords.lon }}
          onSelect={pickLoc}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Explainer modal */}
      {explainer && EXPLAINERS[explainer] && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setExplainer(null)} />
          <div className="relative w-full max-w-md bg-[#10231c] border border-white/10 rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">🎣 {EXPLAINERS[explainer].title}</h3>
              <button
                onClick={() => setExplainer(null)}
                aria-label="Close"
                className="w-9 h-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-lg"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {EXPLAINERS[explainer].body.map((p, i) => (
                <p key={i} className="text-sm text-white/75 leading-relaxed">{p}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
