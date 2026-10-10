// FishMB fishing-tech series, post #1: Garmin LiveScope 2.
// Usage: DATABASE_URL=<redacted> node scripts/fishmb-tech-01.mjs
// Idempotent: skips if a LiveScope 2 post was made in the last 30 days.

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

const BODY = `🎣 FISHING TECH SPOTLIGHT #1: Garmin LiveScope 2

Every Thursday we're going to break down the newest fishing technology — what it does, whether it's worth your money, and how Manitoba anglers are actually using it. Let's start with the biggest launch of the year.

Garmin dropped the LiveScope 2 series back in July, and it's a serious upgrade over LiveScope Plus:

✅ 20% more resolution, 25% more range — out to 250 feet
✅ LiveScope 2 HD gives 50% more detail at casting distances (up to 125 ft)
✅ There's even a dedicated HD ICE FISHING transducer for hard water 🎯
✅ No more separate black box — it plugs straight into your Garmin display

That last one is huge. Anyone who's rigged LiveScope knows the black box was the clunkiest part of the whole system.

The honest debate: forward-facing sonar this good is splitting the fishing world. Major tournaments are restricting or banning live sonar because some say it makes it too easy. But for weekend anglers on Lake Winnipeg or Manitoba? Seeing walleye react to your jig in real time is about as fun as fishing gets.

Manitoba's own Jay Siemens has been putting LiveScope through its paces on the ice — his side-by-side comparisons are worth a watch if you're on the fence.

So what do you think — is live sonar the best tool ever made, or is it taking the skill out of fishing? Drop your take below 👇

Next Thursday: another piece of new tech. Got something you want us to cover? Tell us in the comments.

— FishMB`;

const me = await ensureFishMBUser();
const existing = await sql`
  SELECT id FROM fm_discussions
   WHERE user_id = ${me} AND body LIKE '%FISHING TECH SPOTLIGHT%'
     AND created_at > now() - interval '30 days'
   LIMIT 1`;
if (existing.length > 0) {
  console.log("Tech post #1 already posted recently — skipping.");
  process.exit(0);
}
if (DRY) {
  console.log("[dry-run] WOULD POST:\n" + BODY + "\n---");
  process.exit(0);
}
await sql`
  INSERT INTO fm_discussions (user_id, body, kind, photo_url, photos, visibility)
  VALUES (${me}, ${BODY}, 'post', NULL, '[]'::jsonb, 'public')`;
console.log("Posted fishing-tech #1 (LiveScope 2).");
