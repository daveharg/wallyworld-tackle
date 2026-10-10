// FishMB auto-posts — official feed posts by the FishMB user:
//   Daily: morning weather report (--weather), YouTube video of the day (--youtube-only)
//   1. Manitoba fishing YouTube video of the week (rotates through youtube_shows)
//   2. Queued business ad posts (fm_ads, slot='feed', status='approved')
//   3. Weekly content posts, each on its own day: tip (--tip), lake (--lake), hot spot (--hotspot), lodge (--lodge)
//
// Usage: DATABASE_URL=postgres://... node scripts/fishmb-autopost.mjs [--dry-run]
// Idempotent: skips any post type already posted in the last 7 days.

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const DRY = process.argv.includes("--dry-run");
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !/^postgres(ql)?:\/\//.test(dbUrl)) {
  console.error("DATABASE_URL must be a postgres:// URL");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "public", "fish-manitoba", "data.json"), "utf8"));
const SHOWS = data.youtube_shows ?? [];
const LAKES = data.lakes ?? [];

// Neon serverless driver (HTTPS/WebSocket) — direct TCP Postgres is blocked
// from this environment.
const sql = neon(dbUrl.replace(/channel_binding=require&?/, ""));

async function ensureFishMBUser() {
  const existing = await sql`SELECT id FROM fm_users WHERE google_sub = 'system:fishmb'`;
  if (existing[0]) return existing[0].id;
  if (DRY) return "00000000-0000-0000-0000-000000000000";
  const r = await sql`
    INSERT INTO fm_users (google_sub, name, email, avatar_url, age_confirmed, terms_accepted)
    VALUES ('system:fishmb', 'FishMB', NULL, '/fishmb/icon-192.png', true, true)
    RETURNING id`;
  console.log("Created FishMB official user.");
  return r[0].id;
}

async function alreadyPosted(userId, likePattern, days = 7) {
  const r = await sql`
    SELECT id FROM fm_discussions
     WHERE user_id = ${userId} AND body LIKE ${likePattern}
       AND created_at > now() - (${days} || ' days')::interval
     LIMIT 1`;
  return r.length > 0;
}

async function post(userId, body, photoUrl = null) {
  if (DRY) {
    console.log("[dry-run] WOULD POST:\n" + body + "\n---");
    return;
  }
  const photos = JSON.stringify(photoUrl ? [photoUrl] : []);
  await sql`
    INSERT INTO fm_discussions (user_id, body, kind, photo_url, photos, visibility)
    VALUES (${userId}, ${body}, 'post', ${photoUrl}, ${photos}::jsonb, 'public')`;
  console.log("Posted: " + body.slice(0, 60).replace(/\n/g, " ") + "…");
}

const weekNo = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
const dayNo = Math.floor(Date.now() / (24 * 3600 * 1000));

async function youtubePost(userId) {
  if (SHOWS.length === 0) return;
  if (!FORCE && (await alreadyPosted(userId, "%Manitoba Fishing Video of the Day%", 1))) {
    console.log("YouTube daily post: already posted in the last 24h, skipping.");
    return;
  }
  const show = SHOWS[dayNo % SHOWS.length];
  const video = await latestVideo(show);
  const videoLine = video
    ? `🎥 Watch: ${video.title}\nhttps://www.youtube.com/watch?v=${video.id}`
    : `Give them a watch: ${show.url}`;
  const aboutLine = show.description ? `\n\nAbout ${show.name}: ${show.description}` : "";
  const body =
    `🎬 Manitoba Fishing Video of the Day\n\n` +
    `Today's pick: ${show.name} — some of the best Manitoba fishing content on YouTube.${aboutLine}\n\n` +
    `${videoLine}\n\n` +
    `Know a Manitoba fishing channel we should feature? Drop it in the comments! 👇`;
  await post(userId, body);
}

/** Newest video on a YouTube channel via its public RSS feed (no API key). */
async function latestVideo(show) {
  const param = show.channel_id
    ? `channel_id=${show.channel_id}`
    : show.rss_user
      ? `user=${show.rss_user}`
      : null;
  if (!param) return null;
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?${param}`, {
      headers: { "User-Agent": "FishMB/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const xml = await r.text();
    const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entry) return null;
    const idMatch = entry[1].match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = entry[1].match(/<title>([^<]+)<\/title>/);
    if (!idMatch) return null;
    return { id: idMatch[1], title: titleMatch ? decodeXml(titleMatch[1]) : "their latest video" };
  } catch {
    return null;
  }
}

function decodeXml(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function adPosts(userId) {
  const ads = await sql`
    SELECT a.title, a.body, a.image_url, a.link_url, b.name AS business_name
      FROM fm_ads a
      LEFT JOIN fm_businesses b ON b.id = a.business_id
     WHERE a.slot = 'feed' AND a.status = 'approved'
       AND (a.starts_at IS NULL OR a.starts_at <= now())
       AND (a.ends_at IS NULL OR a.ends_at >= now())
     ORDER BY a.created_at`;
  if (ads.length === 0) {
    console.log("Ad posts: no approved feed ads queued.");
    return;
  }
  for (const ad of ads) {
    const marker = `%📢 ${ad.title}%`;
    if (await alreadyPosted(userId, marker)) {
      console.log(`Ad post "${ad.title}": already posted this week, skipping.`);
      continue;
    }
    let body = `📢 ${ad.title}\n\n${ad.body ?? ""}`.trim();
    if (ad.business_name) body += `\n\n— ${ad.business_name}`;
    if (ad.link_url) body += `\n\n${ad.link_url}`;
    await post(userId, body, ad.image_url ?? null);
    // Mark the ad as posted so it isn't re-posted next week once live.
    if (!DRY) {
      await sql`UPDATE fm_ads SET status = 'posted' WHERE title = ${ad.title} AND status = 'approved'`;
    }
  }
}

const TIPS = [
  "Early-season walleye love current breaks — look for eddies behind points and creek mouths where baitfish stack up.",
  "When the bite is finicky, downsize. A 1/16 oz jig tipped with a minnow will outfish heavy tackle on pressured water.",
  "Wind is your friend: a light chop breaks up light penetration and puts walleye on the feed. Fish the windy side.",
  "Mark every catch in the app, even the dinks. Patterns only show up when you log consistently.",
  "Cold front just rolled through? Slow down, fish tighter to cover, and don't leave fish to find fish.",
];

/** Real, verified lake photos for the weekly posts (public/fishmb/weekly/photos.json). */
function loadWeeklyPhotos() {
  try {
    return JSON.parse(readFileSync(join(root, "public", "fishmb", "weekly", "photos.json"), "utf8"));
  } catch {
    return {};
  }
}
const WEEKLY_PHOTOS = loadWeeklyPhotos();

/** Richer lake blurb assembled from the verified lake directory. */
function lakeBlurb(lake) {
  const lines = [];
  if (lake.region) lines.push(`📍 ${lake.region} Manitoba`);
  const species = (lake.species ?? []).slice(0, 5).join(", ");
  if (species) lines.push(`🐟 ${species}`);
  if (lake.size_text) lines.push(`🌊 ${lake.size_text}`);
  if (lake.max_depth_text) lines.push(`⬇️ Max depth ${lake.max_depth_text}`);
  const division = lake.regulations?.division;
  if (division && !lake.regulations?.division_approximate) lines.push(`📋 ${division} — check 2026 regs before you go`);
  const lodging = (lake.lodging ?? []).length;
  if (lodging > 0) lines.push(`🏕️ ${lodging} verified ${lodging === 1 ? "lodge" : "lodges"} nearby`);
  if (lake.description) {
    const snippet = lake.description.split(/(?<=[.!?])\s/)[0]?.slice(0, 220);
    if (snippet) lines.push(`\n${snippet}`);
  }
  return lines.join("\n");
}

async function tipPost(userId) {
  if (await alreadyPosted(userId, "%🎣 FishMB Tip of the Week%")) {
    console.log("Tip post: already posted this week, skipping.");
    return;
  }
  const tip = TIPS[weekNo % TIPS.length];
  await post(
    userId,
    `🎣 FishMB Tip of the Week\n\n${tip}\n\nGot a tip that's been working for you? Share it below! 👇`
  );
}

async function lakePost(userId) {
  const walleyeLakes = LAKES.filter((l) => (l.species ?? []).some((sp) => /walleye/i.test(sp)));
  if (walleyeLakes.length === 0) return;
  if (await alreadyPosted(userId, "%🌊 Lake of the Week%")) {
    console.log("Lake post: already posted this week, skipping.");
    return;
  }
  const withPhoto = walleyeLakes.filter((l) => WEEKLY_PHOTOS[l.id]);
  const pool = withPhoto.length > 0 ? withPhoto : walleyeLakes;
  const lakeOfWeek = pool[weekNo % pool.length];
  await post(
    userId,
    `🌊 Lake of the Week: ${lakeOfWeek.name}\n\n${lakeBlurb(lakeOfWeek)}\n\nSee the full lake page for 2026 regulations, stocking history, and lodging — then get out there! 🎣`,
    WEEKLY_PHOTOS[lakeOfWeek.id] ?? null
  );
}

async function hotspotPost(userId) {
  const photoLakes = LAKES.filter((l) => WEEKLY_PHOTOS[l.id]);
  if (photoLakes.length === 0) return;
  if (await alreadyPosted(userId, "%🔥 Hot Spot of the Week%")) {
    console.log("Hot spot post: already posted this week, skipping.");
    return;
  }
  const lake = photoLakes[(weekNo + Math.floor(photoLakes.length / 2)) % photoLakes.length];
  await post(
    userId,
    `🔥 Hot Spot of the Week: ${lake.name}\n\n${lakeBlurb(lake)}\n\nOne of Manitoba's premier fishing destinations — who's been out here lately? Drop your reports! 🎣`,
    WEEKLY_PHOTOS[lake.id] ?? null
  );
}

const LODGES = data.lodges ?? [];

/** Richer lodge blurb assembled from the verified lodge directory. */
function lodgeBlurb(lodge) {
  const lines = [];
  if (lodge.location) lines.push(`📍 ${lodge.location}`);
  const species = (lodge.species ?? []).slice(0, 6).join(", ");
  if (species) lines.push(`🐟 ${species}`);
  if (lodge.description) {
    const snippet = lodge.description.split(/(?<=[.!?])\s/)[0]?.slice(0, 240);
    if (snippet) lines.push(`\n${snippet}`);
  }
  if (lodge.website) lines.push(`\n🌐 ${lodge.website}`);
  if (lodge.phone) lines.push(`📞 ${lodge.phone}`);
  return lines.join("\n");
}

async function lodgePost(userId) {
  if (LODGES.length === 0) return;
  if (await alreadyPosted(userId, "%🏕️ Lodge of the Week%")) {
    console.log("Lodge post: already posted this week, skipping.");
    return;
  }
  const withSite = LODGES.filter((l) => l.website);
  const pool = withSite.length > 0 ? withSite : LODGES;
  const lodge = pool[weekNo % pool.length];
  await post(
    userId,
    `🏕️ Lodge of the Week: ${lodge.name}\n\n${lodgeBlurb(lodge)}\n\nKnow this spot? Drop a review in the comments! 🎣`
  );
}

function compass(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

/** Moon phase — same math as the weather page. */
function moonPhase(date = new Date()) {
  const ref = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const now = date.getTime() / 86400000;
  const age = ((((now - ref) % 29.53058867) + 29.53058867) % 29.53058867);
  const illum = Math.round(((1 - Math.cos((age / 29.53058867) * 2 * Math.PI)) / 2) * 100);
  const idx = Math.floor((age / 29.53058867) * 8 + 0.5) % 8;
  const names = ["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous","Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"];
  const icons = ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"];
  return { name: names[idx], icon: icons[idx], illum, idx };
}

function biteOutlook(p, trend, cloud, wind) {
  if (trend <= -2) return { label: "Feeding window", note: "Pressure falling — front coming. Fish now, the bite may die when it hits." };
  if (p >= 1009 && p <= 1022 && trend >= -0.5 && cloud >= 40)
    return { label: "Good", note: "Pressure in the sweet spot, low light. Fish should be active." };
  if (p >= 1009 && p <= 1022)
    return { label: "Fair", note: "Pressure is fine — bright skies may push fish deeper or tighter to cover." };
  if (p > 1030) return { label: "Tough", note: "Very high pressure, bluebird conditions. Slow down, downsize, fish deep." };
  if (wind >= 40) return { label: "Windy", note: "Strong wind — fish the sheltered side and watch the whitecaps." };
  return { label: "Unsettled", note: "Pressure is off the sweet spot. Fish structure and stay adaptable." };
}

async function weatherPost(userId) {
  if (await alreadyPosted(userId, "%FishMB Morning Weather Report%", 1)) {
    console.log("Weather post: already posted in the last 24h, skipping.");
    return;
  }
  const url = "https://api.open-meteo.com/v1/forecast?latitude=49.9&longitude=-97.14" +
    "&current=temperature_2m,apparent_temperature,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m" +
    "&hourly=pressure_msl&daily=temperature_2m_max,temperature_2m_min" +
    "&timezone=America%2FWinnipeg&forecast_days=2";
  let wx = null;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "FishMB/1.0" }, signal: AbortSignal.timeout(15000) });
    if (r.ok) wx = await r.json();
  } catch { /* fall through to text-only post */ }
  const dayName = new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Winnipeg" });
  let body = `☀️ FishMB Morning Weather Report — ${dayName}\n\n📍 Winnipeg area\n`;
  if (wx && wx.current) {
    const c = wx.current;
    let trend = 0;
    try {
      const times = wx.hourly.time ?? [];
      const pressures = wx.hourly.pressure_msl ?? [];
      const nowI = times.findIndex((t) => t >= c.time.slice(0, 13));
      if (nowI >= 3) trend = pressures[nowI] - pressures[nowI - 3];
    } catch { /* ignore */ }
    const trendTxt = trend <= -0.5 ? "falling ↘" : trend >= 0.5 ? "rising ↗" : "steady →";
    const outlook = biteOutlook(c.pressure_msl, trend, c.cloud_cover, c.wind_speed_10m);
    const moon = moonPhase();
    body += `🌡️ ${Math.round(c.temperature_2m)}°C (feels ${Math.round(c.apparent_temperature)}°C)\n` +
      `💨 ${Math.round(c.wind_speed_10m)} km/h ${compass(c.wind_direction_10m)} (gusts ${Math.round(c.wind_gusts_10m)})\n` +
      `☁️ ${c.cloud_cover}% cloud · 🧭 ${c.pressure_msl.toFixed(1)} hPa, ${trendTxt}\n` +
      `🎣 Fish activity: ${outlook.label} — ${outlook.note}\n` +
      `${moon.icon} ${moon.name}, ${moon.illum}% lit\n`;
  } else {
    body += `Today's full forecast didn't load — check the live conditions in the app.\n`;
  }
  body += `\nFull forecast, wind map & pressure gauge 👇\nhttps://www.fishmb.ca/fishmb/weather`;
  await post(userId, body);
}

const userId = await ensureFishMBUser();
const ARGS = process.argv.slice(2);
const has = (f) => ARGS.includes(f);
const YOUTUBE_ONLY = has("--youtube-only");
const NO_YOUTUBE = has("--no-youtube");
// --force bypasses the 24h/7d dedup checks (for a manual run; crons never use it).
const FORCE = has("--force");
// Granular flags for the split weekly/daily schedules.
const ONLY = ["--tip", "--lake", "--hotspot", "--lodge", "--ads", "--weather"].filter(has);
const runAll = ONLY.length === 0;
if (!NO_YOUTUBE && (runAll || YOUTUBE_ONLY)) await youtubePost(userId);
if (!YOUTUBE_ONLY) {
  if (runAll || has("--ads")) await adPosts(userId);
  if (runAll || has("--tip")) await tipPost(userId);
  if (runAll || has("--lake")) await lakePost(userId);
  if (runAll || has("--hotspot")) await hotspotPost(userId);
  if (runAll || has("--lodge")) await lodgePost(userId);
  if (has("--weather")) await weatherPost(userId);
}
console.log(DRY ? "Dry run complete." : "Auto-post batch complete.");
