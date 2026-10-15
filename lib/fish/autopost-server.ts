// FishMB auto-posts, server-side — the deployed-app port of
// scripts/fishmb-autopost.mjs and scripts/fishmb-ice-weekly.mjs.
//
// WHY: the VM cron jobs had to fetch DATABASE_URL out of the Vercel
// dashboard through a browser helper on every run, and the helper
// intermittently refused to hand over the secret (failed runs 2026-10-14
// 05:00 weather, 10:45 monitor). Running the mechanical posts here, in
// the deployed app where DATABASE_URL already lives, removes the
// credential retrieval entirely. Triggered by Vercel Cron through
// app/api/cron/fishmb (see vercel.json + lib/fish/winnipeg-time.ts).
//
// Behaviour is a faithful port of the scripts: same dedupe windows
// (calendar-day, America/Winnipeg), same rotation math, same post bodies.
// One deliberate change: the scripts appended each post to a VM file
// (fb-outbox.jsonl) for the Facebook Page mirror; here each mirrored
// entry is inserted into fm_fb_outbox instead, and the mirror reads it
// through /api/fishmb/admin/fb-outbox. The mirror `type` stores the real
// job type (the file version flattened every autopost entry to "feed").

import fs from "fs";
import path from "path";
import { query, queryOne } from "./db";
import { getFishData, type Lake, type Lodge } from "../fishmb";
import {
  buildWeatherBody,
  snippetOf,
  type WeatherPayload,
} from "./autopost-format";
import { TECH_SPOTLIGHTS } from "./tech-spotlights";

export type AutopostJob =
  | "weather"
  | "video"
  | "tip"
  | "hotspot"
  | "lake"
  | "lodge"
  | "ice"
  | "tech";

export const AUTOPOST_JOBS: AutopostJob[] = [
  "weather",
  "video",
  "tip",
  "hotspot",
  "lake",
  "lodge",
  "ice",
  "tech",
];

// ---------------------------------------------------------------------------
// fm_fb_outbox — the Facebook Page mirror queue (replaces the VM's
// fb-outbox.jsonl). Lazy creation, same pattern as the other fm_* modules.
// ---------------------------------------------------------------------------

let outboxEnsured = false;
export async function ensureFbOutboxTable(): Promise<void> {
  if (outboxEnsured) return;
  await query(
    `CREATE TABLE IF NOT EXISTS fm_fb_outbox (
       id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       ts        timestamptz NOT NULL DEFAULT now(),
       type      text NOT NULL,
       body      text NOT NULL,
       posted_at timestamptz
     )`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_fb_outbox_unposted_idx
       ON fm_fb_outbox (posted_at, ts)`
  );
  outboxEnsured = true;
}

export interface FbOutboxEntry {
  id: string;
  ts: string;
  type: string;
  body: string;
}

/** Unposted mirror entries, oldest first — what the FB mirror posts next. */
export async function listUnpostedFbOutbox(): Promise<FbOutboxEntry[]> {
  await ensureFbOutboxTable();
  return query<FbOutboxEntry>(
    `SELECT id, ts, type, body FROM fm_fb_outbox
      WHERE posted_at IS NULL
      ORDER BY ts ASC, id ASC`
  );
}

/** Mark mirror entries as posted to the Facebook Page. Returns the count. */
export async function markFbOutboxPosted(ids: string[]): Promise<number> {
  await ensureFbOutboxTable();
  if (ids.length === 0) return 0;
  const rows = await query<{ id: string }>(
    `UPDATE fm_fb_outbox SET posted_at = now()
      WHERE id = ANY($1::uuid[]) AND posted_at IS NULL
      RETURNING id`,
    [ids]
  );
  return rows.length;
}

async function mirrorToFbOutbox(type: string, body: string): Promise<void> {
  // A failure here must never break the feed post (same rule as the
  // scripts' file append).
  try {
    await ensureFbOutboxTable();
    await query(`INSERT INTO fm_fb_outbox (type, body) VALUES ($1, $2)`, [
      type,
      body,
    ]);
  } catch {
    /* mirror is best-effort */
  }
}

// ---------------------------------------------------------------------------
// Data (same bundle the scripts read from public/fish-manitoba/data.json)
// ---------------------------------------------------------------------------

interface YoutubeShowFull {
  name: string;
  description?: string;
  channel_id?: string;
  rss_user?: string;
}

function getShows(): YoutubeShowFull[] {
  return (getFishData().youtube_shows ?? []) as unknown as YoutubeShowFull[];
}

let weeklyPhotosCache: Record<string, string> | null = null;
function weeklyPhotos(): Record<string, string> {
  if (weeklyPhotosCache) return weeklyPhotosCache;
  try {
    const p = path.join(process.cwd(), "public", "fishmb", "weekly", "photos.json");
    weeklyPhotosCache = JSON.parse(fs.readFileSync(p, "utf8")) as Record<
      string,
      string
    >;
  } catch {
    weeklyPhotosCache = {};
  }
  return weeklyPhotosCache;
}

// ---------------------------------------------------------------------------
// Core posting primitives (ported from fishmb-autopost.mjs)
// ---------------------------------------------------------------------------

async function ensureFishMBUser(): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM fm_users WHERE google_sub = 'system:fishmb'`
  );
  if (existing) return existing.id;
  const r = await queryOne<{ id: string }>(
    `INSERT INTO fm_users (google_sub, name, email, avatar_url, age_confirmed, terms_accepted)
     VALUES ('system:fishmb', 'FishMB', NULL, '/fishmb/icon-192.png', true, true)
     RETURNING id`
  );
  return r!.id;
}

async function alreadyPosted(
  userId: string,
  likePattern: string,
  days = 7
): Promise<boolean> {
  // Calendar-day comparison (America/Winnipeg), NOT a rolling window: the
  // jobs fire at the same clock time every day, so "last 24h" would always
  // see yesterday's post and skip forever. (Comment carried from the script.)
  const rows = await query<{ id: string }>(
    `SELECT id FROM fm_discussions
      WHERE user_id = $1 AND body LIKE $2
        AND (created_at AT TIME ZONE 'America/Winnipeg')::date
            > (now() AT TIME ZONE 'America/Winnipeg')::date - make_interval(days => $3::int)
      LIMIT 1`,
    [userId, likePattern, days]
  );
  return rows.length > 0;
}

async function postToFeed(
  userId: string,
  type: string,
  body: string,
  photoUrl: string | null,
  log: string[]
): Promise<void> {
  const photos = JSON.stringify(photoUrl ? [photoUrl] : []);
  await query(
    `INSERT INTO fm_discussions (user_id, body, kind, photo_url, photos, visibility)
     VALUES ($1, $2, 'post', $3, $4::jsonb, 'public')`,
    [userId, body, photoUrl, photos]
  );
  const line = "Posted: " + body.slice(0, 60).replace(/\n/g, " ") + "…";
  console.log(line);
  log.push(line);
  await mirrorToFbOutbox(type, body);
}

// Same rotation math as the script (epoch-based, computed per run).
const weekNo = () => Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
const dayNo = () => Math.floor(Date.now() / (24 * 3600 * 1000));

// ---------------------------------------------------------------------------
// YouTube video of the day (script: youtubePost)
// ---------------------------------------------------------------------------

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Newest RSS entry for a show whose video ID is not in seenIds. */
async function newestUnseenVideo(
  show: YoutubeShowFull,
  seenIds: Set<string>
): Promise<{ id: string; title: string } | null> {
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
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    let em: RegExpExecArray | null;
    while ((em = entryRe.exec(xml)) !== null) {
      const entry = em[1];
      const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      if (!idMatch || seenIds.has(idMatch[1])) continue;
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      return {
        id: idMatch[1],
        title: titleMatch ? decodeXml(titleMatch[1]) : "their latest video",
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function youtubePost(userId: string, log: string[]): Promise<void> {
  const shows = getShows();
  if (shows.length === 0) return;
  if (await alreadyPosted(userId, "%Manitoba Fishing Video of the Day%", 1)) {
    log.push("YouTube daily post: already posted today, skipping.");
    return;
  }
  // Never re-post a video that's already been featured.
  const posted = await query<{ body: string }>(
    `SELECT body FROM fm_discussions
      WHERE user_id = $1 AND body LIKE '%youtube.com/watch?v=%'`,
    [userId]
  );
  const seenIds = new Set<string>();
  const idRe = /youtube\.com\/watch\?v=([\w-]{11})/g;
  for (const r of posted) {
    let im: RegExpExecArray | null;
    idRe.lastIndex = 0;
    while ((im = idRe.exec(r.body)) !== null) seenIds.add(im[1]);
  }
  for (let s = 0; s < shows.length; s++) {
    const show = shows[(dayNo() + s) % shows.length];
    const video = await newestUnseenVideo(show, seenIds);
    if (!video) continue;
    const videoLine = `🎥 Watch: ${video.title}\nhttps://www.youtube.com/watch?v=${video.id}`;
    const aboutLine = show.description
      ? `\n\nAbout ${show.name}: ${show.description}`
      : "";
    const body =
      `🎬 Manitoba Fishing Video of the Day\n\n` +
      `Today's pick: ${show.name} — some of the best Manitoba fishing content on YouTube.${aboutLine}\n\n` +
      `${videoLine}\n\n` +
      `Know a Manitoba fishing channel we should feature? Drop it in the comments! 👇`;
    await postToFeed(userId, "video", body, null, log);
    return;
  }
  log.push("YouTube daily post: no new videos from any show, skipping (won't repost).");
}

// ---------------------------------------------------------------------------
// Queued business ads (script: adPosts) — runs with the Monday tip job,
// same as the script's `--tip --ads` invocation.
// ---------------------------------------------------------------------------

interface AdRow {
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  business_name: string | null;
}

async function adPosts(userId: string, log: string[]): Promise<void> {
  const ads = await query<AdRow>(
    `SELECT a.title, a.body, a.image_url, a.link_url, b.name AS business_name
       FROM fm_ads a
       LEFT JOIN fm_businesses b ON b.id = a.business_id
      WHERE a.slot = 'feed' AND a.status = 'approved'
        AND (a.starts_at IS NULL OR a.starts_at <= now())
        AND (a.ends_at IS NULL OR a.ends_at >= now())
      ORDER BY a.created_at`
  );
  if (ads.length === 0) {
    log.push("Ad posts: no approved feed ads queued.");
    return;
  }
  for (const ad of ads) {
    const marker = `%📢 ${ad.title}%`;
    if (await alreadyPosted(userId, marker)) {
      log.push(`Ad post "${ad.title}": already posted this week, skipping.`);
      continue;
    }
    let body = `📢 ${ad.title}\n\n${ad.body ?? ""}`.trim();
    if (ad.business_name) body += `\n\n— ${ad.business_name}`;
    if (ad.link_url) body += `\n\n${ad.link_url}`;
    await postToFeed(userId, "ads", body, ad.image_url ?? null, log);
    // Mark the ad as posted so it isn't re-posted next week once live.
    await query(
      `UPDATE fm_ads SET status = 'posted' WHERE title = $1 AND status = 'approved'`,
      [ad.title]
    );
  }
}

// ---------------------------------------------------------------------------
// Weekly content posts (script: tipPost / lakePost / hotspotPost / lodgePost)
// ---------------------------------------------------------------------------

const TIPS = [
  "Early-season walleye love current breaks — look for eddies behind points and creek mouths where baitfish stack up.",
  "When the bite is finicky, downsize. A 1/16 oz jig tipped with a minnow will outfish heavy tackle on pressured water.",
  "Wind is your friend: a light chop breaks up light penetration and puts walleye on the feed. Fish the windy side.",
  "Mark every catch in the app, even the dinks. Patterns only show up when you log consistently.",
  "Cold front just rolled through? Slow down, fish tighter to cover, and don't leave fish to find fish.",
];

function lakeBlurb(lake: Lake): string {
  const lines: string[] = [];
  if (lake.region) lines.push(`📍 ${lake.region} Manitoba`);
  const species = (lake.species ?? []).slice(0, 5).join(", ");
  if (species) lines.push(`🐟 ${species}`);
  if (lake.size_text) lines.push(`🌊 ${lake.size_text}`);
  if (lake.max_depth_text) lines.push(`⬇️ Max depth ${lake.max_depth_text}`);
  const division = lake.regulations?.division;
  if (division && !lake.regulations?.division_approximate)
    lines.push(`📋 ${division} — check 2026 regs before you go`);
  const lodging = (lake.lodging ?? []).length;
  if (lodging > 0)
    lines.push(`🏕️ ${lodging} verified ${lodging === 1 ? "lodge" : "lodges"} nearby`);
  if (lake.description) {
    const snippet = snippetOf(lake.description, 220);
    if (snippet) lines.push(`\n${snippet}`);
  }
  return lines.join("\n");
}

function lodgeBlurb(lodge: Lodge): string {
  const lines: string[] = [];
  if (lodge.location) lines.push(`📍 ${lodge.location}`);
  const species = (lodge.species ?? []).slice(0, 6).join(", ");
  if (species) lines.push(`🐟 ${species}`);
  if (lodge.description) {
    const snippet = snippetOf(lodge.description, 240);
    if (snippet) lines.push(`\n${snippet}`);
  }
  if (lodge.website) lines.push(`\n🌐 ${lodge.website}`);
  if (lodge.phone) lines.push(`📞 ${lodge.phone}`);
  return lines.join("\n");
}

async function tipPost(userId: string, log: string[]): Promise<void> {
  if (await alreadyPosted(userId, "%🎣 FishMB Tip of the Week%")) {
    log.push("Tip post: already posted this week, skipping.");
    return;
  }
  const tip = TIPS[weekNo() % TIPS.length];
  await postToFeed(
    userId,
    "tip",
    `🎣 FishMB Tip of the Week\n\n${tip}\n\nGot a tip that's been working for you? Share it below! 👇`,
    null,
    log
  );
}

async function lakePost(userId: string, log: string[]): Promise<void> {
  const lakes = getFishData().lakes as unknown as Lake[];
  const photos = weeklyPhotos();
  const walleyeLakes = lakes.filter((l) =>
    (l.species ?? []).some((sp) => /walleye/i.test(sp))
  );
  if (walleyeLakes.length === 0) return;
  if (await alreadyPosted(userId, "%🌊 Lake of the Week%")) {
    log.push("Lake post: already posted this week, skipping.");
    return;
  }
  const withPhoto = walleyeLakes.filter((l) => photos[l.id]);
  const pool = withPhoto.length > 0 ? withPhoto : walleyeLakes;
  const lakeOfWeek = pool[weekNo() % pool.length];
  await postToFeed(
    userId,
    "lake",
    `🌊 Lake of the Week: ${lakeOfWeek.name}\n\n${lakeBlurb(lakeOfWeek)}\n\nSee the full lake page for 2026 regulations, stocking history, and lodging — then get out there! 🎣`,
    photos[lakeOfWeek.id] ?? null,
    log
  );
}

async function hotspotPost(userId: string, log: string[]): Promise<void> {
  const lakes = getFishData().lakes as unknown as Lake[];
  const photos = weeklyPhotos();
  const photoLakes = lakes.filter((l) => photos[l.id]);
  if (photoLakes.length === 0) return;
  if (await alreadyPosted(userId, "%🔥 Hot Spot of the Week%")) {
    log.push("Hot spot post: already posted this week, skipping.");
    return;
  }
  const lake = photoLakes[(weekNo() + Math.floor(photoLakes.length / 2)) % photoLakes.length];
  await postToFeed(
    userId,
    "hotspot",
    `🔥 Hot Spot of the Week: ${lake.name}\n\n${lakeBlurb(lake)}\n\nOne of Manitoba's premier fishing destinations — who's been out here lately? Drop your reports! 🎣`,
    photos[lake.id] ?? null,
    log
  );
}

async function lodgePost(userId: string, log: string[]): Promise<void> {
  const lodges = getFishData().lodges as unknown as Lodge[];
  if (lodges.length === 0) return;
  if (await alreadyPosted(userId, "%🏕️ Lodge of the Week%")) {
    log.push("Lodge post: already posted this week, skipping.");
    return;
  }
  const withSite = lodges.filter((l) => l.website);
  const pool = withSite.length > 0 ? withSite : lodges;
  const lodge = pool[weekNo() % pool.length];
  await postToFeed(
    userId,
    "lodge",
    `🏕️ Lodge of the Week: ${lodge.name}\n\n${lodgeBlurb(lodge)}\n\nKnow this spot? Drop a review in the comments! 🎣`,
    null,
    log
  );
}

// ---------------------------------------------------------------------------
// Morning weather report (script: weatherPost) — body built by the pure
// buildWeatherBody() in autopost-format.ts (byte-identical construction).
// ---------------------------------------------------------------------------

async function weatherPost(userId: string, log: string[]): Promise<void> {
  if (await alreadyPosted(userId, "%FishMB Morning Weather Report%", 1)) {
    log.push("Weather post: already posted today, skipping.");
    return;
  }
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=49.9&longitude=-97.14" +
    "&current=temperature_2m,apparent_temperature,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m" +
    "&hourly=pressure_msl&daily=temperature_2m_max,temperature_2m_min" +
    "&timezone=America%2FWinnipeg&forecast_days=2";
  let wx: WeatherPayload | null = null;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "FishMB/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) wx = (await r.json()) as WeatherPayload;
  } catch {
    /* fall through to text-only post, same as the script */
  }
  const body = buildWeatherBody(wx, new Date());
  await postToFeed(userId, "weather", body, null, log);
}

// ---------------------------------------------------------------------------
// Weekly ice post (script: fishmb-ice-weekly.mjs, Phase 1 ICE COUNTDOWN).
//
// The script's body was written for one run from a checked 7-day forecast
// (Winnipeg / Gimli / Pine Falls) and the phase call was made from that
// forecast: "No sustained sub-zero temperatures anywhere in the south ->
// Phase 1." This port makes the same call from live Open-Meteo forecasts
// and fills the same template with the real numbers. Phase 2 (sustained
// freezing) posts an ICE REPORT built ONLY from the temperature data —
// formation expectations framed as predictions, never invented thickness.
// ---------------------------------------------------------------------------

interface PlaceForecast {
  label: string;
  highs: number[];
  lows: number[];
}

async function fetchPlaceForecast(
  label: string,
  lat: number,
  lng: number
): Promise<PlaceForecast | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=America%2FWinnipeg&forecast_days=7`;
    const r = await fetch(url, {
      headers: { "User-Agent": "FishMB/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
    };
    const highs = j.daily?.temperature_2m_max ?? [];
    const lows = j.daily?.temperature_2m_min ?? [];
    if (highs.length === 0 || lows.length === 0) return null;
    return { label, highs, lows };
  } catch {
    return null;
  }
}

/** Sustained freezing: 3+ consecutive days with highs below 0°C. */
function hasSustainedFreezing(f: PlaceForecast): boolean {
  let run = 0;
  for (const h of f.highs) {
    run = h < 0 ? run + 1 : 0;
    if (run >= 3) return true;
  }
  return false;
}

const fmtRange = (xs: number[]) =>
  `${Math.round(Math.min(...xs))}–${Math.round(Math.max(...xs))}`;

function iceTitleDay(now: Date): string {
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/Winnipeg",
  });
}

function buildIceCountdownBody(now: Date, places: PlaceForecast[]): string {
  const dayRange = `${now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Winnipeg",
  })}–${new Date(now.getTime() + 6 * 86400000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Winnipeg",
  })}`;
  let weekBlock: string;
  if (places.length > 0) {
    const lines = places.map((p) => {
      let line = `• ${p.label}: highs ${fmtRange(p.highs)}°C, overnight lows ${fmtRange(p.lows)}°C`;
      if (p.label.startsWith("Pine Falls")) {
        line += `, coldest nights dipping near ${Math.round(Math.min(...p.lows))}°C`;
      }
      return line;
    });
    const coldest = Math.min(...places.flatMap((p) => p.lows));
    const summary =
      coldest >= 1
        ? "Not a single night below freezing in the south this week."
        : coldest >= -3
          ? "A few nights dip below zero, but nothing sustained."
          : "Some cold nights in the mix, but no sustained deep freeze yet.";
    weekBlock =
      `🌡️ THE WEEK AHEAD (${dayRange})\n${lines.join("\n")}\n\n` +
      `${summary} The lakes are still shedding summer heat, and no skim ice is expected anywhere this week.`;
  } else {
    weekBlock =
      `🌡️ THE WEEK AHEAD\n` +
      `This week's detailed forecast didn't load, so no numbers here — but the seasonal picture is unchanged: real ice needs sustained cold, night after night well below zero, and southern Manitoba isn't there yet.`;
  }
  return `🧊 ICE COUNTDOWN — ${iceTitleDay(now)}

No ice yet, Manitoba — and this week's forecast says we're not close. Here's the honest picture:

${weekBlock}

🔮 FREEZE-UP OUTLOOK (prediction, based on temperature trends)
Real ice needs sustained cold — night after night well below zero so the water can cool down and skin over. In a typical year that's late November to early December for southern Manitoba, and nothing in the current pattern changes that call. We'll sharpen the prediction as real cold shows up in the long-range forecast.

👀 WHAT TO WATCH FOR WHEN IT TURNS
• First skim ice forms in calm, shallow bays and harbours — not on the main lake
• Big water (Lake Winnipeg, Lake Manitoba) freezes last, weeks after small lakes skin over
• Current on the Winnipeg River delays ice even longer — early river ice is never to be trusted

🎒 GEAR PREP WHILE YOU WAIT
Charge the flasher batteries, check those auger blades, put fresh line on the ice rods, and dig out the float suit and ice picks so they're ready when the call comes.

⚠️ SAFETY REMINDER
When the first ice does appear, it is NEVER safe on day one. Once real ice starts forming, these posts switch to ICE REPORTS with verified conditions only — no guesses, no made-up thickness numbers.

This is a prediction, not a promise — Manitoba weather flips fast. See you next Tuesday for the next countdown update. 🧊🎣`;
}

function buildIceReportBody(now: Date, places: PlaceForecast[]): string {
  const lines =
    places.length > 0
      ? places
          .map(
            (p) =>
              `• ${p.label}: highs ${fmtRange(p.highs)}°C, overnight lows ${fmtRange(p.lows)}°C`
          )
          .join("\n")
      : "• (forecast detail unavailable this run)";
  return `🧊 ICE REPORT — ${iceTitleDay(now)}

The cold has arrived in southern Manitoba — sustained below-zero weather is here, and freeze-up is starting. Here's what we can say honestly from the temperature data:

🌡️ THE COLD THIS WEEK
${lines}

Sustained freezing like this is what skins the water over: expect first skim ice in calm, shallow bays and harbours first. Big water (Lake Winnipeg, Lake Manitoba) freezes much later, and current on the Winnipeg River delays ice longest of all. Those are expectations from the temperature trend, not on-the-ground reports.

⚠️ SAFETY — READ THIS
First ice is NEVER safe ice. We have no verified thickness measurements yet, so there are no thickness numbers here and nobody should be venturing out. When verified local reports come in, these posts will carry real conditions only — no guesses.

Stay safe. See you next Tuesday for the next ice update. 🧊🎣`;
}

async function icePost(userId: string, log: string[]): Promise<void> {
  // Script dedupe: skip if an ICE COUNTDOWN/ICE REPORT ran in the last 6 days.
  const recent = await query<{ id: string }>(
    `SELECT id FROM fm_discussions
      WHERE user_id = $1 AND (body LIKE '%ICE COUNTDOWN%' OR body LIKE '%ICE REPORT%')
        AND (created_at AT TIME ZONE 'America/Winnipeg')::date
            > (now() AT TIME ZONE 'America/Winnipeg')::date - make_interval(days => 6)
      LIMIT 1`,
    [userId]
  );
  if (recent.length > 0) {
    log.push("Ice post already published in the last 6 days — skipping.");
    return;
  }
  const places = (
    await Promise.all([
      fetchPlaceForecast("Winnipeg", 49.9, -97.14),
      fetchPlaceForecast("Gimli / Lake Winnipeg shore", 50.63, -96.99),
      fetchPlaceForecast("Pine Falls / Winnipeg River", 50.61, -96.21),
    ])
  ).filter((p): p is PlaceForecast => p !== null);
  const now = new Date();
  const freezing =
    places.length > 0 && places.some((p) => hasSustainedFreezing(p));
  const body = freezing
    ? buildIceReportBody(now, places)
    : buildIceCountdownBody(now, places);
  await postToFeed(userId, "ice", body, null, log);
  log.push(freezing ? "Posted ICE REPORT (Phase 2)." : "Posted ICE COUNTDOWN (Phase 1).");
}

// ---------------------------------------------------------------------------
// Job runner — the cron route calls this. The tip job also runs the ads
// pass, matching the Monday script invocation `--tip --ads`.
// ---------------------------------------------------------------------------

export interface AutopostResult {
  job: AutopostJob;
  log: string[];
}

// ---------------------------------------------------------------------------
// Fishing Tech Spotlight (biweekly, curated — lib/fish/tech-spotlights.ts).
// Server port of the retired VM script job (which had to fetch DATABASE_URL
// out of the Vercel dashboard on every run). Editorial content is curated
// and approved with Dave in advance; this job only decides WHEN the next
// unpublished spotlight goes out.
// ---------------------------------------------------------------------------

/** True when a post whose body contains `marker` exists at any time. */
async function everPosted(userId: string, marker: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM fm_discussions
      WHERE user_id = $1 AND body LIKE $2
      LIMIT 1`,
    [userId, `%${marker}%`]
  );
  return rows.length > 0;
}

async function techPost(
  userId: string,
  log: string[],
  force: boolean
): Promise<void> {
  // Biweekly spacing on scheduled runs: nothing if a spotlight went out in
  // the last 13 days. An admin Run now (force) may post early by Dave's
  // call; the per-spotlight never-posted check below still applies, so the
  // same spotlight can never be posted twice.
  if (!force && (await alreadyPosted(userId, "%FISHING TECH SPOTLIGHT%", 13))) {
    log.push("Tech spotlight: last one is less than 13 days old, skipping.");
    return;
  }
  for (const entry of TECH_SPOTLIGHTS) {
    if (entry.body == null) continue; // pre-server coverage anchor
    const marker = `FISHING TECH SPOTLIGHT #${entry.n}:`;
    if (await everPosted(userId, marker)) continue;
    await postToFeed(userId, "TECH", entry.body, null, log);
    return;
  }
  log.push("Tech spotlight: no unpublished spotlights in the rotation.");
}

export async function runAutopostJob(
  job: AutopostJob,
  opts?: { force?: boolean }
): Promise<AutopostResult> {
  const userId = await ensureFishMBUser();
  const log: string[] = [];
  switch (job) {
    case "weather":
      await weatherPost(userId, log);
      break;
    case "video":
      await youtubePost(userId, log);
      break;
    case "tip":
      await adPosts(userId, log);
      await tipPost(userId, log);
      break;
    case "hotspot":
      await hotspotPost(userId, log);
      break;
    case "lake":
      await lakePost(userId, log);
      break;
    case "lodge":
      await lodgePost(userId, log);
      break;
    case "ice":
      await icePost(userId, log);
      break;
    case "tech":
      await techPost(userId, log, opts?.force === true);
      break;
  }
  for (const line of log) console.log(`[autopost:${job}] ${line}`);
  return { job, log };
}
