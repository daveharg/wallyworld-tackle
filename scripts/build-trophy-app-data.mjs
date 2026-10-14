// Build the app-facing Master Angler trophy data from the verified full
// record book (the merged candidate produced by the audit/merge pass).
//
// Dave's spec (2026-10-13): the app downloads only (a) each lake's TOTAL
// all-time Master Angler record count and (b) the last 5 years of
// records. The full book (251,505 records, 52 MB) stays archived as the
// source of truth in the FishMB goal's hidden_files.
//
// Usage: node scripts/build-trophy-app-data.mjs <path-to-full-book.json>
// Outputs (overwritten):
//   public/fishmb/trophy-records.json — { slug: [records from the last
//     5 years, newest first, exact-catch duplicates merged] }
//   public/fishmb/trophy-totals.json  — { slug: all-time record count }
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-trophy-app-data.mjs <full-book.json>");
  process.exit(1);
}
const book = JSON.parse(fs.readFileSync(src, "utf8"));

const now = new Date();
const cutoff = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());

function parseDate(s) {
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

const totals = {};
const recent = {};
let totalAll = 0;
let totalRecent = 0;

for (const [slug, records] of Object.entries(book)) {
  if (!Array.isArray(records) || records.length === 0) continue;
  totals[slug] = records.length;
  totalAll += records.length;

  const seen = new Set();
  const rows = [];
  for (const r of records) {
    const d = parseDate(r.date);
    if (!d || d < cutoff) continue;
    // The official book lists a few catches twice (once per award
    // category). Merge exact same-catch rows: same angler, species,
    // date and size.
    const key = `${String(r.angler).toLowerCase()}|${String(r.species).toLowerCase()}|${r.date}|${r.inch}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(r);
  }
  rows.sort((a, b) => parseDate(b.date) - parseDate(a.date));
  if (rows.length > 0) {
    recent[slug] = rows;
    totalRecent += rows.length;
  }
}

// Combined directory entries whose Master Angler records live under the
// individual waterbodies on the official site. The directory has one page
// for the group, so the app data needs the union under the group's slug —
// without this, the Shoal Lakes page showed no trophy section at all.
const ALIASES = {
  "shoal-lakes": ["east-shoal-lake", "west-shoal-lake"],
};
for (const [alias, sources] of Object.entries(ALIASES)) {
  const combined = sources.flatMap((s) => book[s] ?? []);
  if (combined.length === 0) continue;
  totals[alias] = combined.length;
  totalAll += combined.length;

  const seen = new Set();
  const rows = [];
  for (const s of sources) {
    for (const r of recent[s] ?? []) {
      // Include the waterbody so a same-day, same-size catch by one angler
      // on the other lake is never merged away.
      const key = `${String(r.waterbody).toLowerCase()}|${String(r.angler).toLowerCase()}|${String(r.species).toLowerCase()}|${r.date}|${r.inch}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(r);
    }
  }
  rows.sort((a, b) => parseDate(b.date) - parseDate(a.date));
  if (rows.length > 0) {
    recent[alias] = rows;
    totalRecent += rows.length;
  }
}

// Sanity gates — fail loudly rather than ship a bad transform.
const sandyTotal = totals["sandy-lake"];
const sandyRecent = recent["sandy-lake"] ?? [];
if (sandyTotal !== 114) throw new Error(`gate: sandy total ${sandyTotal} != 114`);
if (sandyRecent.length !== 5) throw new Error(`gate: sandy recent ${sandyRecent.length} != 5`);
if (!sandyRecent[0].date.includes("2026")) throw new Error("gate: sandy newest is not 2026");
const shoalTotal = totals["shoal-lakes"];
const shoalRecent = recent["shoal-lakes"] ?? [];
if (shoalTotal !== 4674) throw new Error(`gate: shoal-lakes total ${shoalTotal} != 4674 (1488 East + 3186 West)`);
const shoalSourcesRecent = (recent["east-shoal-lake"] ?? []).length + (recent["west-shoal-lake"] ?? []).length;
if (shoalRecent.length !== shoalSourcesRecent) throw new Error(`gate: shoal-lakes recent ${shoalRecent.length} != sources ${shoalSourcesRecent}`);
for (const [slug, rows] of Object.entries(recent)) {
  if (rows.length > totals[slug]) throw new Error(`gate: ${slug} recent > total`);
}

const outDir = path.join(process.cwd(), "public", "fishmb");
fs.writeFileSync(path.join(outDir, "trophy-records.json"), JSON.stringify(recent));
fs.writeFileSync(path.join(outDir, "trophy-totals.json"), JSON.stringify(totals));
console.log(
  `OK: ${Object.keys(totals).length} lakes, ${totalAll} all-time records; ` +
  `${totalRecent} records since ${cutoff.toISOString().slice(0, 10)} across ${Object.keys(recent).length} lakes.`
);
