// FishMB auto-posts — generates the weekly batch of official feed posts:
//   1. Manitoba fishing YouTube video of the week (rotates through youtube_shows)
//   2. Queued business ad posts (fm_ads, slot='feed', status='approved')
//   3. Weekly content posts (fishing tip + lake of the week)
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

async function alreadyPosted(userId, likePattern) {
  const r = await sql`
    SELECT id FROM fm_discussions
     WHERE user_id = ${userId} AND body LIKE ${likePattern}
       AND created_at > now() - interval '7 days'
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

async function youtubePost(userId) {
  if (SHOWS.length === 0) return;
  if (await alreadyPosted(userId, "%Manitoba Fishing Video of the Week%")) {
    console.log("YouTube weekly post: already posted this week, skipping.");
    return;
  }
  const show = SHOWS[weekNo % SHOWS.length];
  const video = await latestVideo(show);
  const videoLine = video
    ? `🎥 Watch: ${video.title}\nhttps://www.youtube.com/watch?v=${video.id}`
    : `Give them a watch: ${show.url}`;
  const body =
    `🎬 Manitoba Fishing Video of the Week\n\n` +
    `This week's pick: ${show.name} — some of the best Manitoba fishing content on YouTube.\n\n` +
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

async function contentPosts(userId) {
  if (await alreadyPosted(userId, "%🎣 FishMB Tip of the Week%")) {
    console.log("Tip post: already posted this week, skipping.");
  } else {
    const tip = TIPS[weekNo % TIPS.length];
    await post(
      userId,
      `🎣 FishMB Tip of the Week\n\n${tip}\n\nGot a tip that's been working for you? Share it below! 👇`
    );
  }
  // Lakes with real verified photos get the rich treatment.
  const photoLakes = LAKES.filter((l) => WEEKLY_PHOTOS[l.id]);
  const walleyeLakes = LAKES.filter((l) => (l.species ?? []).some((s) => /walleye/i.test(s)));
  if (walleyeLakes.length > 0) {
    if (await alreadyPosted(userId, "%🌊 Lake of the Week%")) {
      console.log("Lake post: already posted this week, skipping.");
    } else {
      // Prefer a lake with a real photo; fall back to rotation.
      const withPhoto = walleyeLakes.filter((l) => WEEKLY_PHOTOS[l.id]);
      const pool = withPhoto.length > 0 ? withPhoto : walleyeLakes;
      const lake = pool[weekNo % pool.length];
      await post(
        userId,
        `🌊 Lake of the Week: ${lake.name}\n\n${lakeBlurb(lake)}\n\nSee the full lake page for 2026 regulations, stocking history, and lodging — then get out there! 🎣`,
        WEEKLY_PHOTOS[lake.id] ?? null
      );
    }
  }
  // Hot Spot of the Week — a featured fishing spot with a real photo.
  if (photoLakes.length > 0) {
    if (await alreadyPosted(userId, "%🔥 Hot Spot of the Week%")) {
      console.log("Hot spot post: already posted this week, skipping.");
    } else {
      const lake = photoLakes[weekNo % photoLakes.length];
      await post(
        userId,
        `🔥 Hot Spot of the Week: ${lake.name}\n\n${lakeBlurb(lake)}\n\nOne of Manitoba's premier fishing destinations — who's been out here lately? Drop your reports! 🎣`,
        WEEKLY_PHOTOS[lake.id] ?? null
      );
    }
  }
}

const userId = await ensureFishMBUser();
await youtubePost(userId);
await adPosts(userId);
await contentPosts(userId);
console.log(DRY ? "Dry run complete." : "Auto-post batch complete.");
