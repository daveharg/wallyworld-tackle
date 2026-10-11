// Backfill weather snapshots for FishMB catches logged before weather capture went live.
// Mirrors the client-side capture format exactly (app/fishmb/feed/page.tsx ~L1687):
//   temp_c, code (WMO), feels_like_c, humidity_pct, pressure_hpa, wind_kph,
//   wind_dir_deg, wind_gust_kph, cloud_pct, pressure_trend (rising|falling|steady),
//   moon_phase (0-1), moon_label.
// Uses Open-Meteo's free keyless ARCHIVE API (historical hourly data).
// Only fm_catches is covered: fm_tournament_entries has no lat/lng/weather columns.
//
// Usage (from the repo root, uses the repo's own node_modules):
//   DATABASE_URL=<...> node scripts/catch-weather-backfill.mjs            # dry run: prints what would update
//   DATABASE_URL=<...> node scripts/catch-weather-backfill.mjs --apply   # actually UPDATEs fm_catches.weather
//
// DATABASE_URL (Neon Postgres) is NOT in this VM's env. Retrieve read-only from the
// Vercel dashboard -> team wallyworld -> project wallyworld-tackle -> Settings ->
// Environment Variables -> open the DATABASE_URL row menu -> "Manage Connection"
// (Neon integration "wallyworld-db") -> "Show secret". Export inline for the node
// invocation only; never write the value to any file. Clear shell history after.

import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !/^postgres(ql)?:\/\//.test(dbUrl)) {
  console.error("DATABASE_URL must be a postgres:// URL");
  process.exit(1);
}
const sql = neon(dbUrl);

function moonLabel(phase) {
  return phase < 0.03 || phase > 0.97 ? "New moon"
    : phase < 0.22 ? "Waxing crescent"
    : phase < 0.28 ? "First quarter"
    : phase < 0.47 ? "Waxing gibbous"
    : phase < 0.53 ? "Full moon"
    : phase < 0.72 ? "Waning gibbous"
    : phase < 0.78 ? "Last quarter"
    : "Waning crescent";
}

function moonPhase(dateMs) {
  const synodic = 29.530588853;
  const known = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const phase = (((dateMs / 86400000 - known) % synodic) + synodic) % synodic / synodic;
  return { phase: Math.round(phase * 100) / 100, label: moonLabel(phase) };
}

// Fetch archive hourly data for the catch date (plus the previous day for the 3h pressure lookback).
async function fetchArchive(lat, lng, caughtAt) {
  const day = new Date(caughtAt.getTime() - 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
    `&start_date=${fmt(day)}&end_date=${fmt(caughtAt)}` +
    `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,` +
    `pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`archive API ${res.status}`);
  return res.json();
}

function buildWeather(archive, caughtAt) {
  const times = archive?.hourly?.time;
  const H = archive?.hourly;
  if (!times || !H) return null;
  const target = caughtAt.getTime();
  // Hourly times are local ISO strings; shift caught_at to the archive's local clock to match.
  const localTarget = new Date(target + archive.utc_offset_seconds * 1000);
  const localIso = localTarget.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  let idx = 0, best = Infinity;
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i].slice(0, 13) + ":00:00Z").getTime() - new Date(localIso + ":00:00Z").getTime());
    if (diff < best) { best = diff; idx = i; }
  }
  const v = (arr) => (arr && Number.isFinite(arr[idx]) ? arr[idx] : undefined);
  const temp = v(H.temperature_2m), code = v(H.weather_code);
  if (!Number.isFinite(temp) || !Number.isFinite(code)) return null;
  const weather = { temp_c: Math.round(temp), code };
  const rounded = (key, arr) => { const x = v(arr); if (x !== undefined) weather[key] = Math.round(x); };
  rounded("feels_like_c", H.apparent_temperature);
  rounded("humidity_pct", H.relative_humidity_2m);
  rounded("pressure_hpa", H.pressure_msl);
  rounded("wind_kph", H.wind_speed_10m);
  rounded("wind_dir_deg", H.wind_direction_10m);
  rounded("wind_gust_kph", H.wind_gusts_10m);
  rounded("cloud_pct", H.cloud_cover);
  // Pressure trend: same ±0.8 hPa / 3h rule as the client.
  const hp = H.pressure_msl;
  if (hp && idx >= 3 && Number.isFinite(hp[idx]) && Number.isFinite(hp[idx - 3])) {
    const d = hp[idx] - hp[idx - 3];
    weather.pressure_trend = d > 0.8 ? "rising" : d < -0.8 ? "falling" : "steady";
  }
  const { phase, label } = moonPhase(target);
  weather.moon_phase = phase;
  weather.moon_label = label;
  return weather;
}

async function main() {
  const rows = await sql`
    SELECT id, caught_at, lat, lng, species FROM fm_catches
    WHERE weather IS NULL AND lat IS NOT NULL AND lng IS NOT NULL AND caught_at IS NOT NULL
    ORDER BY caught_at`;
  console.log(`${rows.length} catch(es) missing weather (with GPS + date).`);
  let updated = 0, skipped = 0;
  for (const r of rows) {
    try {
      const caughtAt = new Date(r.caught_at);
      const archive = await fetchArchive(r.lat, r.lng, caughtAt);
      const weather = buildWeather(archive, caughtAt);
      if (!weather) { skipped++; console.log(`  skip ${String(r.id).slice(0, 8)} (${r.species}): no archive data`); continue; }
      if (APPLY) {
        await sql`UPDATE fm_catches SET weather = ${JSON.stringify(weather)}::jsonb WHERE id = ${r.id}`;
        updated++;
      } else {
        updated++; // counted as would-update in dry run
      }
      console.log(`  ${APPLY ? "updated" : "would update"} ${String(r.id).slice(0, 8)} ${r.species} @ ${caughtAt.toISOString()}:`,
        `${weather.temp_c}°C, ${weather.pressure_hpa ?? "?"} hPa${weather.pressure_trend ? " " + weather.pressure_trend : ""}, ` +
        `${weather.wind_kph ?? "?"} km/h, ${weather.moon_label}`);
      await sleep(400); // polite pacing for the free API
    } catch (e) {
      skipped++;
      console.log(`  skip ${String(r.id).slice(0, 8)} (${r.species}): ${e.message}`);
    }
  }
  console.log(APPLY ? `Done: ${updated} updated, ${skipped} skipped.` : `Dry run: ${updated} would update, ${skipped} skipped. Run with --apply to write.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
