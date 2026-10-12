"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackArrow from "../../_components/BackArrow";
import { fishFetch } from "../../_components/fishFetch";
import CatchLocationMap from "../_components/CatchLocationMap";

interface CatchDetail {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  species: string;
  length_in: string | null;
  weight_lb: string | null;
  depth_ft: string | null;
  photo_hold_url: string | null;
  photo_measure_url: string | null;
  photos: string[] | null;
  caught_at: string;
  lat: number | null;
  lng: number | null;
  note: string | null;
  feed_caption: string | null;
  visibility: string;
  personal_record: boolean;
  weather: Record<string, number | string> | null;
}

const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow",
  75: "Heavy snow", 77: "Snow grains", 80: "Light showers", 81: "Showers",
  82: "Violent showers", 85: "Light snow showers", 86: "Snow showers",
  95: "Thunderstorm", 96: "Storm + hail", 99: "Storm + heavy hail",
};

function windDir(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function fmtDate(d: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    }).format(new Date(d));
  } catch {
    return d;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper-deep rounded-2xl px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-pine/45">{label}</p>
      <p className="text-pine font-bold text-lg mt-0.5">{value}</p>
    </div>
  );
}

export default function CatchDetailPage({ params }: { params: { id: string } }) {
  const [c, setC] = useState<CatchDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fishFetch(`/api/fish/catches/${params.id}`)
      .then((d) => setC(d.catch as CatchDetail))
      .catch(() => setMissing(true));
  }, [params.id]);

  if (missing) notFound();
  if (!c) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <BackArrow />
        <div className="h-64 bg-pine/5 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const photos = [c.photo_hold_url, c.photo_measure_url, ...(c.photos ?? [])].filter(
    (p, i, arr): p is string => !!p && arr.indexOf(p) === i
  );
  const w = c.weather ?? {};
  const num = (k: string): number | null => {
    const v = w[k];
    return typeof v === "number" ? v : null;
  };
  const str = (k: string): string | null => {
    const v = w[k];
    return typeof v === "string" ? v : null;
  };
  const hasWeather = Object.keys(w).length > 0;
  const windKph = num("wind_kph");
  const windDirDeg = num("wind_dir_deg");
  const gustKph = num("wind_gust_kph");
  const code = num("code");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
      <BackArrow />
      <div className="flex items-center gap-3 mb-5">
        {c.user_avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.user_avatar} alt="" className="w-11 h-11 rounded-full object-cover" />
        ) : (
          <span className="w-11 h-11 rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine">
            {c.user_name.charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <Link href={`/fishmb/anglers/${c.user_id}`} className="font-bold text-pine hover:underline">
            {c.user_name}
          </Link>
          <p className="text-xs text-pine/50">{fmtDate(c.caught_at)}</p>
        </div>
      </div>

      {photos.length > 0 && (
        <div className={`grid gap-2 mb-6 ${photos.length > 1 ? "grid-cols-2" : ""}`}>
          {photos.slice(0, 4).map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={p} alt={c.species} className="w-full rounded-3xl object-cover aspect-[4/3] bg-pine/5" />
          ))}
        </div>
      )}

      <h1 className="font-display font-bold uppercase text-pine text-3xl tracking-wide mb-4">
        {c.species}
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
        {c.length_in && <Stat label="Length" value={`${c.length_in}″`} />}
        {c.weight_lb && <Stat label="Weight" value={`${c.weight_lb} lb`} />}
        {c.depth_ft && <Stat label="Water depth" value={`${c.depth_ft} ft`} />}
        <Stat label="Visibility" value={c.visibility === "public" ? "Shared" : c.visibility === "friends" ? "Friends" : "Private"} />
        {c.personal_record && <Stat label="Personal best" value="Yes" />}
      </div>

      {(c.note || c.feed_caption) && (
        <div className="bg-white border border-pine/10 rounded-3xl p-5 mb-6">
          {c.feed_caption && <p className="text-pine/80 leading-relaxed">{c.feed_caption}</p>}
          {c.note && (
            <p className="text-pine/60 text-sm leading-relaxed mt-2 italic">{c.note}</p>
          )}
        </div>
      )}

      {c.lat != null && c.lng != null && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-2 px-1">
            Where it was caught
          </h2>
          <CatchLocationMap lat={c.lat} lng={c.lng} />
        </div>
      )}

      {hasWeather && (
        <div className="bg-white border border-pine/10 rounded-3xl p-5 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-pine/55 mb-3">
            Weather at catch time
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {num("temp_c") != null && (
              <Stat label="Temp" value={`${num("temp_c")}°C`} />
            )}
            {num("feels_like_c") != null && (
              <Stat label="Feels like" value={`${num("feels_like_c")}°C`} />
            )}
            {code != null && (
              <Stat label="Conditions" value={WMO[code] ?? `Code ${code}`} />
            )}
            {windKph != null && (
              <Stat
                label="Wind"
                value={`${windKph} km/h${windDirDeg != null ? ` ${windDir(windDirDeg)}` : ""}`}
              />
            )}
            {gustKph != null && gustKph > 0 && (
              <Stat label="Gusts" value={`${gustKph} km/h`} />
            )}
            {num("pressure_hpa") != null && (
              <Stat
                label="Pressure"
                value={`${num("pressure_hpa")} hPa${str("pressure_trend") ? ` ${str("pressure_trend")}` : ""}`}
              />
            )}
            {num("humidity_pct") != null && (
              <Stat label="Humidity" value={`${num("humidity_pct")}%`} />
            )}
            {num("cloud_pct") != null && (
              <Stat label="Cloud cover" value={`${num("cloud_pct")}%`} />
            )}
            {str("moon_label") && (
              <Stat label="Moon" value={str("moon_label")!} />
            )}
          </div>
          {str("pressure_trend") === "falling" && (
            <p className="text-xs text-pine/55 mt-3">
              Falling pressure — a front may be moving in. Fish often feed hard ahead of it.
            </p>
          )}
          {str("pressure_trend") === "rising" && (
            <p className="text-xs text-pine/55 mt-3">
              Rising pressure — typically stable, post-front conditions.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
