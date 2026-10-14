// Pure formatting helpers for the server-side FishMB auto-posts.
// Ported verbatim from scripts/fishmb-autopost.mjs (and the ice post
// template in scripts/fishmb-ice-weekly.mjs). No imports, so the weather
// body builder can be exercised standalone against the script's format.

/** First full sentence of a description, without splitting on abbreviations
 *  like "est.", "St.", "Ltd." (the old naive split cut blurbs off mid-phrase —
 *  the 2026-10-13 Lodge of the Week went out as "Historic lodge (est."). */
const ABBR_NEVER_END = new Set([
  "est", "st", "ste", "dr", "mt", "ft", "ca", "approx", "no", "vol",
  "e.g", "i.e", "u.s", "u.s.a", "p.o",
]);
const ABBR_MAY_END = new Set(["inc", "ltd", "co", "bros", "corp"]);

export function firstSentence(text: string): string {
  const re = /[.!?]+(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(0, m.index);
    const lastWord = (before.match(/(\S+)$/)?.[1] ?? "").replace(/^[("']+/, "");
    const norm = lastWord.toLowerCase().replace(/[."']+$/, "");
    if (ABBR_NEVER_END.has(norm)) continue;
    if (ABBR_MAY_END.has(norm)) {
      // "…Inc. In winter…" can be a real sentence end; "Hastings Bros. Outfitters"
      // and "…Ltd. is…" cannot. Treat as an end only when a capital follows and
      // a real sentence's worth of text precedes it.
      const nextChar = text[m.index + m[0].length + 1] ?? "";
      if (!/[A-Z]/.test(nextChar) || before.length < 50) continue;
    }
    if (/^[A-Z]$/.test(lastWord)) continue; // single capital initial, e.g. "J. Smith"
    return text.slice(0, m.index + m[0].length);
  }
  return text;
}

/** First sentence capped at n chars; when the cap bites, back off to a word boundary. */
export function snippetOf(text: string, n: number): string {
  const s = firstSentence(text);
  if (!s || s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).trimEnd();
}

export function compass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

export interface MoonPhase {
  name: string;
  icon: string;
  illum: number;
  idx: number;
}

/** Moon phase — same math as the weather page. */
export function moonPhase(date: Date = new Date()): MoonPhase {
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const now = date.getTime() / 86400000;
  const age = (((now - ref) % 29.53058867) + 29.53058867) % 29.53058867;
  const illum = Math.round(((1 - Math.cos((age / 29.53058867) * 2 * Math.PI)) / 2) * 100);
  const idx = Math.floor((age / 29.53058867) * 8 + 0.5) % 8;
  const names = [
    "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
    "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent",
  ];
  const icons = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
  return { name: names[idx], icon: icons[idx], illum, idx };
}

export interface BiteOutlook {
  label: string;
  note: string;
}

export function biteOutlook(
  p: number,
  trend: number,
  cloud: number,
  wind: number
): BiteOutlook {
  if (trend <= -2)
    return {
      label: "Feeding window",
      note: "Pressure falling — front coming. Fish now, the bite may die when it hits.",
    };
  if (p >= 1009 && p <= 1022 && trend >= -0.5 && cloud >= 40)
    return {
      label: "Good",
      note: "Pressure in the sweet spot, low light. Fish should be active.",
    };
  if (p >= 1009 && p <= 1022)
    return {
      label: "Fair",
      note: "Pressure is fine — bright skies may push fish deeper or tighter to cover.",
    };
  if (p > 1030)
    return {
      label: "Tough",
      note: "Very high pressure, bluebird conditions. Slow down, downsize, fish deep.",
    };
  if (wind >= 40)
    return {
      label: "Windy",
      note: "Strong wind — fish the sheltered side and watch the whitecaps.",
    };
  return {
    label: "Unsettled",
    note: "Pressure is off the sweet spot. Fish structure and stay adaptable.",
  };
}

/** The Open-Meteo payload shape the weather post consumes. */
export interface WeatherPayload {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    cloud_cover: number;
    pressure_msl: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  hourly?: { time?: string[]; pressure_msl?: number[] };
  daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
}

/**
 * Build the "FishMB Morning Weather Report" body — byte-for-byte the same
 * construction as weatherPost() in scripts/fishmb-autopost.mjs, including
 * the High/Low line (Dave's 2026-10-13 requirement).
 */
export function buildWeatherBody(wx: WeatherPayload | null, now: Date): string {
  const dayName = now.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Winnipeg",
  });
  let body = `☀️ FishMB Morning Weather Report — ${dayName}\n\n📍 Winnipeg area\n`;
  if (wx && wx.current) {
    const c = wx.current;
    let trend = 0;
    try {
      const times = wx.hourly?.time ?? [];
      const pressures = wx.hourly?.pressure_msl ?? [];
      const nowI = times.findIndex((t) => t >= c.time.slice(0, 13));
      if (nowI >= 3) trend = pressures[nowI] - pressures[nowI - 3];
    } catch {
      /* ignore */
    }
    const trendTxt = trend <= -0.5 ? "falling ↘" : trend >= 0.5 ? "rising ↗" : "steady →";
    const outlook = biteOutlook(c.pressure_msl, trend, c.cloud_cover, c.wind_speed_10m);
    const moon = moonPhase(now);
    const hi = wx.daily?.temperature_2m_max?.[0];
    const lo = wx.daily?.temperature_2m_min?.[0];
    const hiLo =
      hi != null && lo != null
        ? ` · High ${Math.round(hi)}°C · Low ${Math.round(lo)}°C`
        : "";
    body +=
      `🌡️ ${Math.round(c.temperature_2m)}°C (feels ${Math.round(c.apparent_temperature)}°C)${hiLo}\n` +
      `💨 ${Math.round(c.wind_speed_10m)} km/h ${compass(c.wind_direction_10m)} (gusts ${Math.round(c.wind_gusts_10m)})\n` +
      `☁️ ${c.cloud_cover}% cloud · 🧭 ${c.pressure_msl.toFixed(1)} hPa, ${trendTxt}\n` +
      `🎣 Fish activity: ${outlook.label} — ${outlook.note}\n` +
      `${moon.icon} ${moon.name}, ${moon.illum}% lit\n`;
  } else {
    body += `Today's full forecast didn't load — check the live conditions in the app.\n`;
  }
  body += `\nFull forecast, wind map & pressure gauge 👇\nhttps://www.fishmb.ca/fishmb/weather`;
  return body;
}
