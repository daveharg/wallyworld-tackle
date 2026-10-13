// FishMB recommendations monitor — lists recommendations newer than the
// stored watermark; --ack advances it. Run by the
// fishmb-recommendations-monitor cron; silent when there's nothing new.
//
// Usage:
//   DATABASE_URL=<url> node scripts/fishmb-recommendations-check.mjs
//   DATABASE_URL=<url> node scripts/fishmb-recommendations-check.mjs --ack <iso8601>

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !/^postgres(ql)?:\/\//.test(dbUrl)) {
  console.error("DATABASE_URL must be a postgres:// URL");
  process.exit(1);
}
const sql = neon(dbUrl);

const here = dirname(fileURLToPath(import.meta.url));
const watermarkPath = join(
  here,
  "../../goals/fish-manitoba-iphone-app/hidden_files/recommendations-watermark.json"
);

function readWatermark() {
  try {
    if (existsSync(watermarkPath)) {
      const data = JSON.parse(readFileSync(watermarkPath, "utf8"));
      if (data && typeof data.seen_until === "string") return data.seen_until;
    }
  } catch {
    // fall through to epoch
  }
  return "1970-01-01T00:00:00.000Z";
}

const ackIdx = process.argv.indexOf("--ack");
if (ackIdx >= 0) {
  const iso = process.argv[ackIdx + 1];
  if (!iso || Number.isNaN(Date.parse(iso))) {
    console.error("--ack needs an ISO timestamp");
    process.exit(1);
  }
  mkdirSync(dirname(watermarkPath), { recursive: true });
  writeFileSync(watermarkPath, JSON.stringify({ seen_until: iso }, null, 2));
  console.log(`watermark advanced to ${iso}`);
  process.exit(0);
}

const seenUntil = readWatermark();
const rows = await sql`
  SELECT r.id, r.kind, r.subject, r.message, r.name, r.email, r.page,
         u.name AS user_name, r.created_at
    FROM fm_recommendations r
    LEFT JOIN fm_users u ON u.id = r.user_id
   WHERE r.created_at > ${seenUntil} AND r.status = 'new'
   ORDER BY r.created_at ASC
   LIMIT 50
`;
if (rows.length === 0) {
  console.log("NONE");
  process.exit(0);
}
console.log(JSON.stringify({ seen_until: seenUntil, count: rows.length, items: rows }, null, 2));
