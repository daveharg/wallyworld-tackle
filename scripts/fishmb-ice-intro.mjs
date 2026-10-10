// FishMB ice-reports intro post — posts once, then a cron runs follow-ups.
// Usage: DATABASE_URL=<redacted> node scripts/fishmb-ice-intro.mjs
// Idempotent: skips if an ice-report intro was posted in the last 30 days.

import { neon } from "@neondatabase/serverless";

const DRY = process.argv.includes("--dry-run");
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !/^postgres(ql)?:\/\//.test(dbUrl)) {
  console.error("DATABASE_URL must be a postgres:// URL");
  process.exit(1);
}
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

const BODY = `🧊 HARD WATER SEASON IS COMING, MANITOBA!

Who else is already getting excited for ice fishing? There's nothing like that first walk out onto solid ice, auger in hand, walleye biting under your boots. ❄️🎣

Here's what we're doing for you this season: once we're getting close to ice forming on Lake Manitoba and the Winnipeg River, FishMB will post DAILY ice condition updates right here in the feed — ice thickness, snow depths, and what we're seeing at popular access points, so you know exactly when it's safe to get out there.

No more guessing. No more sketchy Facebook rumors. Just the ice info you need, every day.

Stay tuned — we'll be posting updates and reminders as freeze-up gets closer. Drop a 🧊 in the comments if you're ready to hit the hard water!

Tight lines,
— FishMB`;

const me = await ensureFishMBUser();
const existing = await sql`
  SELECT id FROM fm_discussions
   WHERE user_id = ${me} AND body LIKE '%HARD WATER SEASON IS COMING%'
     AND created_at > now() - interval '30 days'
   LIMIT 1`;
if (existing.length > 0) {
  console.log("Ice intro already posted recently — skipping.");
  process.exit(0);
}
if (DRY) {
  console.log("[dry-run] WOULD POST:\n" + BODY + "\n---");
  process.exit(0);
}
await sql`
  INSERT INTO fm_discussions (user_id, body, kind, photo_url, photos, visibility)
  VALUES (${me}, ${BODY}, 'post', NULL, '[]'::jsonb, 'public')`;
console.log("Posted ice-reports intro.");
