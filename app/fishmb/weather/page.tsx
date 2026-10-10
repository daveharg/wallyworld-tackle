"use client";

import { useEffect, useMemo, useState } from "react";
import LocationPicker, { WxLoc } from "./_components/LocationPicker";
import FishLoader from "../_components/FishLoader";
import WeatherLoader from "../_components/WeatherLoader";

/* ------------------------------------------------------------------ */
/* WMO weather-code → label + SVG icon                                   */
/* ------------------------------------------------------------------ */
function weatherIcon(code: number): string {
  // Returns an SVG string for the weather condition.
  const sun = `<circle cx="12" cy="12" r="5" fill="#FDB813"/><g stroke="#FDB813" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.8" y2="4.2"/></g>`;
  const cloud = `<path d="M17.5 19a4.5 4.5 0 0 0 .42-8.98 6 6 0 0 0-11.7 1.62A4 4 0 0 0 7 19h10.5z" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>`;
  const rain = cloud + `<g stroke="#3B82F6" stroke-width="2" stroke-linecap="round"><line x1="8" y1="21" x2="7" y2="24"/><line x1="12" y1="21" x2="11" y2="24"/><line x1="16" y1="21" x2="15" y2="24"/></g>`;
  const snow = cloud + `<g fill="#3B82F6"><circle cx="8" cy="22" r="1.2"/><circle cx="12" cy="22" r="1.2"/><circle cx="16" cy="22" r="1.2"/></g>`;
  const storm = cloud + `<path d="M12 15l-3 5h4l-1 4 5-7h-4l3-5h-4z" fill="#F59E0B"/>`;
  const fog = `<g stroke="#94A3B8" stroke-width="2" stroke-linecap="round"><line x1="4" y1="10" x2="20" y2="10"/><line x1="6" y1="14" x2="18" y2="14"/><line x1="4" y1="18" x2="20" y2="18"/></g>`;

  if (code === 0) return `<svg viewBox="0 0 24 24" width="72" height="72">${sun}</svg>`;
  if (code === 1) return `<svg viewBox="0 0 24 24" width="72" height="72">${sun}<g transform="translate(6,8) scale(0.7)">${cloud}</g></svg>`;
  if (code === 2) return `<svg viewBox="0 0 24 24" width="72" height="72">${cloud}</svg>`;
  if (code === 3) return `<svg viewBox="0 0 24 24" width="72" height="72"><g opacity="0.9">${cloud}</g><g transform="translate(0,-3)">${cloud}</g></svg>`;
  if (code === 45 || code === 48) return `<svg viewBox="0 0 24 24" width="72" height="72">${fog}</svg>`;
  if (code >= 51 && code <= 57) return `<svg viewBox="0 0 24 24" width="72" height="72">${rain}</svg>`;
  if (code >= 61 && code <= 67) return `<svg viewBox="0 0 24 24" width="72" height="72">${rain}</svg>`;
  if (code >= 71 && code <= 77) return `<svg viewBox="0 0 24 24" width="72" height="72">${snow}</svg>`;
  if (code >= 80 && code <= 82) return `<svg viewBox="0 0 24 24" width="72" height="72">${rain}</svg>`;
  if (code === 85 || code === 86) return `<svg viewBox="0 0 24 24" width="72" height="72">${snow}</svg>`;
  if (code >= 95) return `<svg viewBox="0 0 24 24" width="72" height="72">${storm}</svg>`;
  return `<svg viewBox="0 0 24 24" width="72" height="72">${cloud}</svg>`;
}

function wmo(code: number): { label: string; icon: string } {
 if (code === 0) return { label: "Clear sky", icon: weatherIcon(code) };
 if (code === 1) return { label: "Mostly clear", icon: weatherIcon(code) };
 if (code === 2) return { label: "Partly cloudy", icon: weatherIcon(code) };
 if (code === 3) return { label: "Overcast", icon: weatherIcon(code) };
 if (code === 45 || code === 48) return { label: "Fog", icon: weatherIcon(code) };
 if (code >= 51 && code <= 57) return { label: "Drizzle", icon: weatherIcon(code) };
 if (code >= 61 && code <= 67) return { label: "Rain", icon: weatherIcon(code) };
 if (code >= 71 && code <= 77) return { label: "Snow", icon: weatherIcon(code) };
 if (code >= 80 && code <= 82) return { label: "Showers", icon: weatherIcon(code) };
 if (code === 85 || code === 86) return { label: "Snow showers", icon: weatherIcon(code) };
 if (code >= 95) return { label: "Thunderstorm", icon: weatherIcon(code) };
 return { label: "—", icon: weatherIcon(2) };
}

function compass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

/* Moon phase — computed from the synodic cycle (no API needed) */
function moonPhase(date = new Date()): { name: string; icon: string; illum: number; idx: number } {
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000; // known new moon
  const now = date.getTime() / 86400000;
  const age = ((((now - ref) % 29.53058867) + 29.53058867) % 29.53058867);
  const illum = Math.round(((1 - Math.cos((age / 29.53058867) * 2 * Math.PI)) / 2) * 100);
  const idx = Math.floor((age / 29.53058867) * 8 + 0.5) % 8;
  const phases = [
 { name: "New Moon", icon: "" },
 { name: "Waxing Crescent", icon: "" },
 { name: "First Quarter", icon: "" },
 { name: "Waxing Gibbous", icon: "" },
 { name: "Full Moon", icon: "" },
 { name: "Waning Gibbous", icon: "" },
 { name: "Last Quarter", icon: "" },
 { name: "Waning Crescent", icon: "" },
  ];
  return { ...phases[idx], illum, idx };
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
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; pressure_msl: number[]; weather_code: number[]; wind_speed_10m: number[]; wind_gusts_10m: number[] };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
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
  const cx = 100, cy = 105, r = 80;
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
  const ticks: number[] = [];
  for (let p = MIN; p <= MAX; p += 10) ticks.push(p);
  return (
    <svg viewBox="0 0 200 155" className="w-full">
      {zones.map(([p0, p1, c], i) => (
        <path key={i} d={arc(ang(p0), ang(p1))} stroke={c} strokeWidth="12" fill="none" strokeLinecap="butt" />
      ))}
      {/* Tick marks + small numbers */}
      {ticks.map((p) => {
        const a = ang(p);
        const x1 = cx + 70 * Math.cos(rad(a)), y1 = cy - 70 * Math.sin(rad(a));
        const x2 = cx + 76 * Math.cos(rad(a)), y2 = cy - 76 * Math.sin(rad(a));
        const lx = cx + 58 * Math.cos(rad(a)), ly = cy - 58 * Math.sin(rad(a));
        return (
          <g key={p}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#12322b" strokeOpacity="0.45" strokeWidth="1.5" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#12322b" opacity="0.6">
              {p}
            </text>
          </g>
        );
      })}
      {/* Ideal band label, centered on the green band */}
      <text
        x={cx + 80 * Math.cos(rad(ang(1015.5)))}
        y={cy - 80 * Math.sin(rad(ang(1015.5)))}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="7.5"
        fontWeight="800"
        fill="#12322b"
      >
        IDEAL
      </text>
      {/* Needle */}
      <line x1={cx} y1={cy} x2={cx + 64 * Math.cos(rad(angle))} y2={cy - 64 * Math.sin(rad(angle))} stroke="#12322b" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#12322b" />
      <text x={cx} y={cy + 28} textAnchor="middle" fontSize="16" fontWeight="900" fill="#12322b">
        {value.toFixed(1)}
      </text>
      <text x={cx} y={cy + 41} textAnchor="middle" fontSize="8.5" fill="#12322b" opacity="0.65">
        hPa
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 7-day pressure history sparkline — shows when fronts came through     */
/* ------------------------------------------------------------------ */
function PressureHistory({ times, pressures, nowTime }: { times: string[]; pressures: number[]; nowTime: string }) {
  const W = 300, H = 64, PAD = 4;
  if (!times.length || !pressures.length) return null;
  const min = Math.min(...pressures) - 1;
  const max = Math.max(...pressures) + 1;
  const n = pressures.length;
  const x = (i: number) => PAD + (i / Math.max(1, n - 1)) * (W - PAD * 2);
  const y = (p: number) => PAD + (1 - (p - min) / Math.max(0.1, max - min)) * (H - PAD * 2);
  const d = pressures.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  // "now" marker
  const nowIdx = times.findIndex((t) => t >= nowTime.slice(0, 13));
  const nx = nowIdx > 0 ? x(nowIdx) : x(n - 1);
  // day ticks (every 24h from the end)
  const ticks: number[] = [];
  for (let i = n - 1; i >= 0; i -= 24) ticks.push(i);
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full mt-2">
      {ticks.map((i) => (
        <line key={i} x1={x(i)} y1={PAD} x2={x(i)} y2={H - PAD} stroke="#12322b" strokeOpacity="0.12" strokeWidth="1" />
      ))}
      <path d={d} fill="none" stroke="#0284c7" strokeWidth="2" />
      <line x1={nx} y1={PAD} x2={nx} y2={H - PAD} stroke="#12322b" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 2" />
      <text x={W - 2} y={H + 11} textAnchor="end" fontSize="8" fill="#12322b" opacity="0.45">7-day pressure history</text>
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
  moon: {
    title: "Moon phase",
    body: [
      "Many anglers plan around solunar theory: the major feeding windows line up with moonrise and moonset, and they run strongest around the full and new moons.",
      "Full moon: bright nights can push the feed after dark — the daytime bite often comes early or late. Fish the low-light windows hard.",
      "New moon: darkest nights, and often the best daytime bite of the lunar cycle.",
      "Treat the moon as one more clue stacked with pressure, wind and light — not gospel on its own.",
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Fish activity forecast: rest of today, tomorrow, best times          */
/* ------------------------------------------------------------------ */

/** Score one hour's fishing quality 0-100 from pressure and trend. */
function hourScore(pressure: number, trend3h: number): number {
  let s = 50;
  // Sweet spot pressure.
  if (pressure >= 1009 && pressure <= 1022) s += 25;
  else if (pressure >= 1005 && pressure <= 1026) s += 10;
  else if (pressure > 1030 || pressure < 1000) s -= 20;
  // Falling pressure ahead of a front = feeding window.
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

function fmtHour(iso: string): string {
  try {
    const d = new Date(iso);
    let h = d.getHours();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}${ap}`;
  } catch {
    return "";
  }
}

interface DayForecast {
  label: string;
  color: string;
  note: string;
  avgPressure: number;
  avgTrend: number;
  hours: number;
}

/** Human-readable reasons behind a rest-of-day / tomorrow outlook. */
function dayReasons(title: string, d: DayForecast): string[] {
  const reasons: string[] = [];
  const p = d.avgPressure;
  const t = d.avgTrend;
  reasons.push(
    `Based on ${d.hours} forecast hour${d.hours === 1 ? "" : "s"} for ${title.toLowerCase()}.`
  );
  if (p >= 1009 && p <= 1022) {
    reasons.push(
      `Average pressure ${p.toFixed(0)} hPa — in the 1009–1022 sweet spot where fish feed most actively.`
    );
  } else if (p >= 1005 && p <= 1026) {
    reasons.push(
      `Average pressure ${p.toFixed(0)} hPa — near the ideal range.`
    );
  } else if (p > 1030 || p < 1000) {
    reasons.push(
      `Average pressure ${p.toFixed(0)} hPa — outside the comfort zone, which drags the rating down.`
    );
  }
  if (t <= -1) {
    reasons.push(
      `Pressure trending down (${t.toFixed(1)} hPa/3h) — falling pressure ahead of a front often triggers feeding.`
    );
  } else if (t >= 1) {
    reasons.push(
      `Pressure trending up (${t.toFixed(1)} hPa/3h) — rising pressure after a front can slow the bite.`
    );
  } else {
    reasons.push(
      `Pressure holding steady (${t >= 0 ? "+" : ""}${t.toFixed(1)} hPa/3h) — stable conditions.`
    );
  }
  return reasons;
}

interface BestWindow {
  start: string;
  end: string;
  score: number;
  avgPressure: number;
  avgTrend: number;
}

/** Human-readable reasons why a best-time window scored well. */
function windowReasons(w: BestWindow): string[] {
  const reasons: string[] = [];
  const p = w.avgPressure;
  const t = w.avgTrend;
  if (p >= 1009 && p <= 1022) {
    reasons.push(
      `Pressure sits at ${p.toFixed(0)} hPa — right in the 1009–1022 sweet spot where fish feed most actively.`
    );
  } else if (p >= 1005 && p <= 1026) {
    reasons.push(
      `Pressure near ${p.toFixed(0)} hPa — close to the ideal range, comfortable for feeding fish.`
    );
  }
  if (t <= -2) {
    reasons.push(
      `Pressure is falling fast (${t.toFixed(1)} hPa/3h) — fish often feed hard ahead of an incoming front.`
    );
  } else if (t <= -1) {
    reasons.push(
      `Pressure easing down (${t.toFixed(1)} hPa/3h) — a gentle drop that can turn the bite on.`
    );
  } else if (t >= 2) {
    reasons.push(
      `Pressure rising (${t.toFixed(1)} hPa/3h) — post-front conditions; fish may be sluggish, work slow and deep.`
    );
  } else {
    reasons.push(
      `Pressure steady (${t >= 0 ? "+" : ""}${t.toFixed(1)} hPa/3h) — stable conditions, fish settle into a pattern.`
    );
  }
  return reasons;
}

function fishingForecast(
  hourlyTime: string[],
  hourlyPressure: number[],
  nowIdx: number
): { restOfDay: DayForecast; tomorrow: DayForecast; bestTimes: BestWindow[] } {
  // Score every hour from now through end of tomorrow.
  const scores: { idx: number; score: number }[] = [];
  for (let i = nowIdx; i < hourlyPressure.length; i++) {
    const p = hourlyPressure[i];
    const prev = hourlyPressure[Math.max(0, i - 3)];
    scores.push({ idx: i, score: hourScore(p, p - prev) });
  }
  const avg = (list: { score: number }[]) =>
    list.length ? list.reduce((a, b) => a + b.score, 0) / list.length : 50;

  // Rest of today: hours remaining before midnight.
  const todayStr = hourlyTime[nowIdx]?.slice(0, 10) ?? "";
  const restToday = scores.filter((s) => (hourlyTime[s.idx] ?? "").slice(0, 10) === todayStr);
  const restAvg = avg(restToday);
  const restInfo = scoreLabel(restAvg);

  // Tomorrow: all hours with tomorrow's local date.
  const tomorrowStr = (() => {
    const t = hourlyTime[nowIdx] ?? "";
    // hourly times are local ISO (YYYY-MM-DDTHH:MM) — add a day in local time.
    const d = new Date(t.slice(0, 10) + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();
  const tomorrowScores = scores.filter((s) => {
    const t = hourlyTime[s.idx] ?? "";
    return t.slice(0, 10) === tomorrowStr;
  });
  const tomAvg = avg(tomorrowScores);
  const tomInfo = scoreLabel(tomAvg);

  // Average pressure + trend for a set of scored hours (for explanations).
  const avgPT = (list: { idx: number }[]) => {
    if (!list.length) return { p: 0, t: 0 };
    let ps = 0, ts = 0;
    for (const s of list) {
      const ix = s.idx;
      const p = hourlyPressure[ix] ?? 0;
      ps += p;
      ts += p - (hourlyPressure[Math.max(0, ix - 3)] ?? 0);
    }
    return { p: ps / list.length, t: ts / list.length };
  };
  const restPT = avgPT(restToday);
  const tomPT = avgPT(tomorrowScores);

  // Best 3-hour windows: sliding window over the scored hours.
  const windows: BestWindow[] = [];
  for (let i = 0; i + 2 < scores.length; i += 1) {
    const wAvg = (scores[i].score + scores[i + 1].score + scores[i + 2].score) / 3;
    const idxs = [scores[i].idx, scores[i + 1].idx, scores[i + 2].idx];
    const pressures = idxs.map((ix) => hourlyPressure[ix] ?? 0);
    const trends = idxs.map((ix) => (hourlyPressure[ix] ?? 0) - (hourlyPressure[Math.max(0, ix - 3)] ?? 0));
    windows.push({
      start: fmtHour(hourlyTime[scores[i].idx] ?? ""),
      end: fmtHour(hourlyTime[scores[i + 2].idx] ?? ""),
      score: wAvg,
      avgPressure: pressures.reduce((a, b) => a + b, 0) / 3,
      avgTrend: trends.reduce((a, b) => a + b, 0) / 3,
    });
  }
  windows.sort((a, b) => b.score - a.score);
  // Pick top 2 non-overlapping windows.
  const best: BestWindow[] = [];
  for (const w of windows) {
    if (best.length >= 2) break;
    if (w.score < 55) break;
    best.push(w);
  }

  return {
    restOfDay: {
      ...restInfo,
      avgPressure: restPT.p,
      avgTrend: restPT.t,
      hours: restToday.length,
      note:
        restToday.length === 0
          ? "Day's about done."
          : restAvg >= 70
            ? "Conditions hold — get out there."
            : restAvg >= 50
              ? "Decent window left today."
              : "Bite likely fading.",
    },
    tomorrow: {
      ...tomInfo,
      avgPressure: tomPT.p,
      avgTrend: tomPT.t,
      hours: tomorrowScores.length,
      note:
        tomAvg >= 70
          ? "Looks like a good day to fish."
          : tomAvg >= 50
            ? "Fishable — watch the pressure trend."
            : "Tough conditions expected.",
    },
    bestTimes: best,
  };
}

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
  const [bestExplainIdx, setBestExplainIdx] = useState<number | null>(null);
  const [dayExplain, setDayExplain] = useState<"rest" | "tomorrow" | null>(null);
  const [windFull, setWindFull] = useState(false);

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
          `&hourly=temperature_2m,precipitation_probability,pressure_msl,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max` +
          `&timezone=auto&forecast_days=7&past_days=7`;
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
    if (!data) return null;    const c = data.current;
    // Index of the current hour / current day inside the series (past_days=7
    // means hourly[0] and daily[0] are 7 days ago, NOT now).
    const nowHourIdx = (() => {
      const i = data.hourly.time.findIndex((t) => t >= c.time.slice(0, 13));
      return i > 0 ? i : data.hourly.time.length - 1;
    })();
    const todayIdx = (() => {
      const i = data.daily.time.findIndex((t) => t >= c.time.slice(0, 10));
      return i >= 0 ? i : data.daily.time.length - 1;
    })();
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
    const forecast = fishingForecast(data.hourly.time, data.hourly.pressure_msl, nowHourIdx);
    // Long-range front analysis: scan the full past pressure history for the
    // steepest drop (a front coming through). After a cold front the bite can
    // stay off for days, so anglers need to see WHEN it hit, not just the 3h trend.
    let frontAgoH: number | null = null;
    let frontDrop = 0;
    try {
      const ps = data.hourly.pressure_msl;
      const idx = data.hourly.time.findIndex((t) => t >= c.time.slice(0, 13));
      const nowI = idx > 0 ? idx : ps.length - 1;
      // steepest 12-hour drop in the past data (front signature)
      let best = 0;
      let bestI = -1;
      for (let j = Math.max(0, nowI - 7 * 24); j <= nowI - 12; j++) {
        const drop = ps[j] - ps[j + 12];
        if (drop > best) { best = drop; bestI = j; }
      }
      if (best >= 4 && bestI >= 0) {
        frontDrop = best;
        frontAgoH = nowI - (bestI + 12); // hours since the drop completed
      }
    } catch {
      frontAgoH = null;
    }
    const front =
      trend <= -2
 ? { label: "Front approaching", color: "#ef4444", icon: "" }
        : trend >= 2
 ? { label: "Front passing", color: "#f59e0b", icon: "" }
          : frontAgoH !== null && frontAgoH < 72
 ? { label: "Post-front", color: "#f59e0b", icon: "" }
 : { label: "Stable", color: "#22c55e", icon: "" };
    return { c, trend, outlook, forecast, front, frontAgoH, frontDrop, wmo: wmo(c.weather_code), nowHourIdx, todayIdx };
  }, [data]);

  const moon = useMemo(() => moonPhase(), []);

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
    <div className="min-h-screen bg-white text-pine pb-32">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-100/60 via-white to-white" />
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="relative max-w-2xl mx-auto px-5 pt-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setPickerOpen(true)} className="text-left group">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-pine/50">FishMB Weather</p>
              <h1 className="text-lg font-black">
 {coords.label} <span className="text-pine/40 text-sm group-active:text-pine/60">▾</span>
              </h1>
            </button>
          </div>

          {err && <p className="mt-6 text-sm text-red-600">{err}</p>}

          {derived ? (
            <>
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-7xl font-black tracking-tight">{Math.round(derived.c.temperature_2m)}°</div>
                    <p className="mt-1 text-pine/60 text-sm">
                      {derived.wmo.label} · Feels {Math.round(derived.c.apparent_temperature)}°
                    </p>
                  </div>
                  <div
                    className="shrink-0 flex items-center justify-center pr-2"
                    dangerouslySetInnerHTML={{ __html: derived.wmo.icon }}
                    aria-hidden="true"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2.5 mt-4">
                  <div className="rounded-2xl bg-white/70 border border-pine/10 px-3 py-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-pine/45">High</p>
                    <p className="text-2xl font-black text-pine mt-0.5">
                      {data && derived ? Math.round(data.daily.temperature_2m_max[derived.todayIdx] ?? 0) : "—"}°
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/70 border border-pine/10 px-3 py-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-pine/45">Low</p>
                    <p className="text-2xl font-black text-pine mt-0.5">
                      {data && derived ? Math.round(data.daily.temperature_2m_min[derived.todayIdx] ?? 0) : "—"}°
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/70 border border-pine/10 px-3 py-3 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-pine/45">Humidity</p>
                    <p className="text-2xl font-black text-pine mt-0.5">
                      {derived.c.relative_humidity_2m}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Fish activity banner */}
              <div className="mt-5 rounded-3xl bg-pine/[0.04] border border-pine/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: derived.outlook.color }} />
                  <div>
                    <p className="text-sm font-black">
                      Fish activity: <span style={{ color: derived.outlook.color }}>{derived.outlook.label}</span>
                    </p>
                    <p className="text-xs text-pine/60 mt-0.5">{derived.outlook.note}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mt-3">
                  <button
                    type="button"
                    onClick={() => setDayExplain("rest")}
                    className="text-left rounded-2xl bg-pine/[0.04] border border-pine/10 px-3 py-2.5 active:scale-[0.98] transition"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-pine/45">
                      Rest of today <span className="text-pine/40 font-normal">ⓘ</span>
                    </p>
                    <p className="text-sm font-extrabold mt-0.5" style={{ color: derived.forecast.restOfDay.color }}>
                      {derived.forecast.restOfDay.label}
                    </p>
                    <p className="text-[11px] text-pine/55 mt-0.5 leading-snug">
                      {derived.forecast.restOfDay.note}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDayExplain("tomorrow")}
                    className="text-left rounded-2xl bg-pine/[0.04] border border-pine/10 px-3 py-2.5 active:scale-[0.98] transition"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-pine/45">
                      Tomorrow <span className="text-pine/40 font-normal">ⓘ</span>
                    </p>
                    <p className="text-sm font-extrabold mt-0.5" style={{ color: derived.forecast.tomorrow.color }}>
                      {derived.forecast.tomorrow.label}
                    </p>
                    <p className="text-[11px] text-pine/55 mt-0.5 leading-snug">
                      {derived.forecast.tomorrow.note}
                    </p>
                  </button>
                </div>
                {derived.forecast.bestTimes.length > 0 && (
                  <div className="mt-2.5 rounded-2xl bg-pine/[0.04] border border-pine/10 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-pine/45">
                      Best times to fish
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {derived.forecast.bestTimes.map((w, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setBestExplainIdx(i)}
                          className="text-sm font-bold text-pine bg-white border border-pine/15 rounded-full px-3 py-1.5 active:scale-95 transition"
                        >
                          {w.start}–{w.end} <span className="text-pine/40 font-normal">ⓘ</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            !err && (
              <div className="flex items-center justify-center min-h-[60vh]">
                <WeatherLoader />
              </div>
            )
          )}
        </div>
      </div>

      {derived && data && (
        <div className="max-w-2xl mx-auto px-5 space-y-4 mt-5">
          {/* Fishing-conditions cards */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setExplainer("pressure")} className="text-left rounded-3xl bg-pine/[0.04] border border-pine/10 p-4 active:scale-[0.98] transition">
              <p className="text-[10px] font-bold uppercase tracking-widest text-pine/50">Pressure</p>
              <div className="mt-1 -mb-1"><PressureGauge value={derived.c.pressure_msl} /></div>
              <p className="text-[11px] text-pine/60">
                {derived.trend <= -0.5 ? "↘ falling" : derived.trend >= 0.5 ? "↗ rising" : "→ steady"} · {Math.abs(derived.trend).toFixed(1)} hPa/3h
              </p>
              <p className="text-[10px] text-pine/50 mt-1 underline underline-offset-2">How to read it for fishing</p>
            </button>

            <button onClick={() => setExplainer("wind")} className="text-left rounded-3xl bg-pine/[0.04] border border-pine/10 p-4 active:scale-[0.98] transition">
              <p className="text-[10px] font-bold uppercase tracking-widest text-pine/50">Wind</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="relative w-14 h-14 rounded-full border border-pine/20 shrink-0">
                  <span
                    className="absolute inset-0 flex items-start justify-center text-lg"
                    style={{ transform: `rotate(${derived.c.wind_direction_10m}deg)` }}
                  >
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">{compass(derived.c.wind_direction_10m)}</span>
                </div>
                <div>
                  <p className="text-2xl font-black">{Math.round(derived.c.wind_speed_10m)}<span className="text-xs font-bold text-pine/50"> km/h</span></p>
                  <p className="text-[11px] text-pine/60">Gusts {Math.round(derived.c.wind_gusts_10m)} km/h</p>
                </div>
              </div>
              <p className="text-[10px] text-pine/50 mt-2 underline underline-offset-2">How to read it for fishing</p>
            </button>

            <button onClick={() => setExplainer("cloud")} className="text-left rounded-3xl bg-pine/[0.04] border border-pine/10 p-4 active:scale-[0.98] transition">
              <p className="text-[10px] font-bold uppercase tracking-widest text-pine/50">Cloud cover</p>
              <p className="text-3xl font-black mt-2">{derived.c.cloud_cover}<span className="text-sm font-bold text-pine/50">%</span></p>
              <p className="text-[11px] text-pine/60 mt-1">
                {derived.c.cloud_cover >= 70 ? "Overcast — prime low light" : derived.c.cloud_cover >= 30 ? "Partly cloudy — watch the sun breaks" : "Clear — fish shade and depth"}
              </p>
              <p className="text-[10px] text-pine/50 mt-1 underline underline-offset-2">How to read it for fishing</p>
            </button>

            <button onClick={() => setExplainer("moon")} className="text-left rounded-3xl bg-pine/[0.04] border border-pine/10 p-4 active:scale-[0.98] transition">
              <p className="text-[10px] font-bold uppercase tracking-widest text-pine/50">Moon</p>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-4xl">{moon.icon}</p>
                <div>
                  <p className="text-sm font-black">{moon.name}</p>
                  <p className="text-[11px] text-pine/60">{moon.illum}% lit</p>
                </div>
              </div>
              <p className="text-[11px] text-pine/60 mt-1">
                {moon.idx === 4 ? "Full moon — strongest solunar feed windows" : moon.idx === 0 ? "New moon — often the best daytime bite" : "Feed windows peak near full & new moons"}
              </p>
              <p className="text-[10px] text-pine/50 mt-1 underline underline-offset-2">How to read it for fishing</p>
            </button>

            <button onClick={() => setExplainer("front")} className="text-left rounded-3xl bg-pine/[0.04] border border-pine/10 p-4 active:scale-[0.98] transition col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-pine/50">Storm front</p>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-3xl">{derived.front.icon}</p>
                <div>
                  <p className="text-sm font-black" style={{ color: derived.front.color }}>{derived.front.label}</p>
                  <p className="text-[11px] text-pine/60">3h trend {derived.trend >= 0 ? "+" : ""}{derived.trend.toFixed(1)} hPa</p>
                </div>
              </div>
              {derived.frontAgoH !== null && (
                <p className="text-[11px] text-pine/60 mt-1">
 Cold front came through ~{derived.frontAgoH < 24 ? `${Math.round(derived.frontAgoH)}h` : `${Math.round(derived.frontAgoH / 24)}d`} ago
                  ({derived.frontDrop.toFixed(0)} hPa drop). Bite can stay off for days after — fish slow and deep.
                </p>
              )}
              {data && <PressureHistory times={data.hourly.time} pressures={data.hourly.pressure_msl} nowTime={data.current.time} />}
              <p className="text-[10px] text-pine/50 mt-1 underline underline-offset-2">How to read it for fishing</p>
            </button>
          </div>

          {/* Live wind map */}
          <section className="rounded-3xl overflow-hidden border border-pine/10 bg-pine/[0.04]">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h2 className="text-sm font-black">Live wind map</h2>
              <span className="text-[10px] text-pine/40">windy.com</span>
            </div>
            <button
              onClick={() => setWindFull(true)}
              className="relative block w-full cursor-pointer group"
              aria-label="Open wind map full screen"
            >
              <iframe
                title="Live wind map"
                src={windySrc}
                className="w-full h-80 border-0 pointer-events-none"
                loading="lazy"
              />
              <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-bold rounded-full px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
 Full screen
              </span>
            </button>
            <p className="px-4 py-2.5 text-[11px] text-pine/50">
              Live wind over your waters. Tap the map for full screen — zoom in to your lake, fish the windy side of structure where bait stacks up.
            </p>
          </section>

          {/* Hourly */}
          <section className="rounded-3xl bg-pine/[0.04] border border-pine/10 p-4">
            <h2 className="text-sm font-black mb-3">Next 24 hours</h2>
            <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
              {data.hourly.time.slice(derived.nowHourIdx, derived.nowHourIdx + 24).map((t, i) => {
                const hr = parseInt(t.slice(11, 13), 10);
                const gi = derived.nowHourIdx + i;
                return (
                  <div key={t} className="flex flex-col items-center gap-1 min-w-12 text-center">
                    <span className="text-[10px] text-pine/50 font-bold">{i === 0 ? "Now" : `${hr}:00`}</span>
                    <span className="text-lg">{wmo(data.hourly.weather_code[gi] ?? 0).icon}</span>
                    <span className="text-xs font-black">{Math.round(data.hourly.temperature_2m[gi])}°</span>
                    <span className="text-[10px] text-sky-600">{Math.round(data.hourly.precipitation_probability[gi] ?? 0)}%</span>
                    <span className="text-[10px] text-pine/55">💨{Math.round(data.hourly.wind_speed_10m[gi] ?? 0)}</span>
                    <span className="text-[10px] text-pine/35">g{Math.round(data.hourly.wind_gusts_10m[gi] ?? 0)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 7-day */}
          <section className="rounded-3xl bg-pine/[0.04] border border-pine/10 p-4">
            <h2 className="text-sm font-black mb-2">7-day</h2>
            {data.daily.time.slice(derived.todayIdx, derived.todayIdx + 7).map((t, i) => {
              const gi = derived.todayIdx + i;
              const d = new Date(t + "T12:00:00");
              const day = i === 0 ? "Today" : d.toLocaleDateString("en-CA", { weekday: "short" });
              const w = wmo(data.daily.weather_code[gi]);
              return (
                <div key={t} className="flex items-center gap-3 py-2.5 border-b border-pine/5 last:border-0">
                  <span className="w-16 text-xs font-bold text-pine/60">{day}</span>
                  <span className="text-lg">{w.icon}</span>
                  <span className="flex-1 text-[11px] text-pine/50">{w.label}</span>
                  <span className="text-[11px] text-pine/45 w-20 text-right">💨 {Math.round(data.daily.wind_speed_10m_max[gi] ?? 0)} <span className="text-pine/35">g{Math.round(data.daily.wind_gusts_10m_max[gi] ?? 0)}</span></span>
                  <span className="text-xs text-pine/50">{Math.round(data.daily.temperature_2m_min[gi])}°</span>
                  <span className="text-xs font-black w-10 text-right">{Math.round(data.daily.temperature_2m_max[gi])}°</span>
                </div>
              );
            })}
          </section>

          <p className="text-[10px] text-pine/30 text-center pb-2">
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
          <div className="relative w-full max-w-md bg-white border border-pine/10 rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black">{EXPLAINERS[explainer].title}</h3>
              <button
                onClick={() => setExplainer(null)}
                aria-label="Close"
                className="w-9 h-9 shrink-0 rounded-full bg-pine/5 flex items-center justify-center text-lg text-pine"
              >
 
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {EXPLAINERS[explainer].body.map((p, i) => (
                <p key={i} className="text-sm text-pine/75 leading-relaxed">{p}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rest-of-day / tomorrow explainer modal */}
      {dayExplain !== null && derived && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDayExplain(null)} />
          <div className="relative w-full max-w-md bg-white border border-pine/10 rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black text-pine">
                Why {dayExplain === "rest" ? "rest of today" : "tomorrow"} is rated{" "}
                <span style={{ color: derived.forecast[dayExplain === "rest" ? "restOfDay" : "tomorrow"].color }}>
                  {derived.forecast[dayExplain === "rest" ? "restOfDay" : "tomorrow"].label}
                </span>?
              </h3>
              <button
                onClick={() => setDayExplain(null)}
                aria-label="Close"
                className="w-9 h-9 shrink-0 rounded-full bg-pine/5 flex items-center justify-center text-lg text-pine"
              >
 
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {dayReasons(
                dayExplain === "rest" ? "Rest of today" : "Tomorrow",
                derived.forecast[dayExplain === "rest" ? "restOfDay" : "tomorrow"]
              ).map((r, i) => (
                <p key={i} className="text-sm text-pine/75 leading-relaxed">{r}</p>
              ))}
              <p className="text-xs text-pine/50 leading-relaxed">
                The rating averages every forecast hour's score — built from pressure level and 3-hour pressure trend.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Best-times explainer modal */}
      {bestExplainIdx !== null && derived && derived.forecast.bestTimes[bestExplainIdx] && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setBestExplainIdx(null)} />
          <div className="relative w-full max-w-md bg-white border border-pine/10 rounded-3xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black text-pine">
                Why {derived.forecast.bestTimes[bestExplainIdx].start}–{derived.forecast.bestTimes[bestExplainIdx].end}?
              </h3>
              <button
                onClick={() => setBestExplainIdx(null)}
                aria-label="Close"
                className="w-9 h-9 shrink-0 rounded-full bg-pine/5 flex items-center justify-center text-lg text-pine"
              >
 
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {windowReasons(derived.forecast.bestTimes[bestExplainIdx]).map((r, i) => (
                <p key={i} className="text-sm text-pine/75 leading-relaxed">{r}</p>
              ))}
              <p className="text-xs text-pine/50 leading-relaxed">
                Windows are scored from hourly pressure and 3-hour pressure trend — the two strongest bite predictors in the forecast.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen wind map */}
      {windFull && (
        <div className="fixed inset-0 z-50 bg-black">
          <button
            onClick={() => setWindFull(false)}
            aria-label="Back to weather"
            className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-sm font-bold rounded-full pl-3 pr-4 py-2.5 backdrop-blur transition-colors"
          >
            ← Back
          </button>
          <iframe
            title="Live wind map — full screen"
            src={windySrc}
            className="w-full h-full border-0"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
