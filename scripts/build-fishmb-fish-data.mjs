/**
 * Build lib/fishmb-fish-data.json — the data behind the FishMB "Fish" tab
 * (/fishmb/fish index + upgraded /fishmb/species/<slug> pages).
 *
 * Sources (nothing is authored here — content is only carried across):
 *  - Species set + per-species lake lists: FishMB's own catalogue,
 *    public/fish-manitoba/data.json (the same bundle the webapp's lake
 *    pages use), with coordinates from public/fishmb/lake-coords.json.
 *  - Full per-species guides + scientific names + Manitoba Master Angler
 *    minimums: the Bump Board site's composed data file,
 *    ../bump-board-api/src/data/site/species.json (`guides`, `tipSpecies`,
 *    `maBySpecies`) — the same guides bumpboard.ca/species/<slug> renders,
 *    themselves composed from the app's researched fishing library.
 *
 * A Manitoba species with no guide in that library is recorded with
 * guideId: null and the pages say so plainly (no substitute content).
 *
 * Run: node scripts/build-fishmb-fish-data.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bbSpeciesPath = join(root, "..", "bump-board-api", "src", "data", "site", "species.json");

const fishData = JSON.parse(readFileSync(join(root, "public", "fish-manitoba", "data.json"), "utf8"));
const coords = JSON.parse(readFileSync(join(root, "public", "fishmb", "lake-coords.json"), "utf8"));
const bb = JSON.parse(readFileSync(bbSpeciesPath, "utf8"));

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** FishMB species name -> Bump Board guide id, where the names differ. */
const GUIDE_ALIASES = {
  "Northern Pike": "pike",
  "Yellow Perch": "perch",
  "Cisco (Tullibee)": "cisco",
  "Largemouth Bass": "largemouth",
  "Smallmouth Bass": "smallmouth",
};
const guideIdFor = (name) => {
  if (GUIDE_ALIASES[name]) return GUIDE_ALIASES[name];
  const norm = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return bb.guides[norm] ? norm : null;
};

/** Master Angler minimums are keyed by spKey (parentheticals stripped);
 *  a few Manitoba names land on the program's grouped keys instead. */
const spKey = (s) =>
  String(s).replace(/\([^)]*\)/g, " ").toLowerCase().replace(/[^a-z0-9]+/g, "");
const MA_ALIASES = { cisco: "tullibee", brownbullhead: "bullhead", blackbullhead: "bullhead", whitesucker: "sucker", pumpkinseed: "sunfish" };
const maMinFor = (name, guideId) => {
  const key = spKey(name);
  return bb.maBySpecies[key] ?? (MA_ALIASES[key] ? bb.maBySpecies[MA_ALIASES[key]] : undefined) ??
    (guideId && MA_ALIASES[guideId] ? bb.maBySpecies[MA_ALIASES[guideId]] : undefined) ?? null;
};

const scientificByGuideId = {};
for (const t of bb.tipSpecies) scientificByGuideId[t.id] = t.scientific;

// Manitoba species set, derived from FishMB's own lake catalogue.
const names = new Set();
for (const lake of fishData.lakes) for (const s of lake.species) names.add(s);

const species = [];
const guides = {};
for (const name of [...names].sort()) {
  const guideId = guideIdFor(name);
  if (guideId) {
    if (!bb.guides[guideId]) throw new Error(`guide id ${guideId} for ${name} missing in Bump Board data`);
    guides[guideId] = bb.guides[guideId];
  }
  const lakes = fishData.lakes.filter((l) => l.species.includes(name));
  species.push({
    name,
    slug: slugify(name),
    guideId,
    scientific: guideId ? scientificByGuideId[guideId] ?? null : null,
    maMin: maMinFor(name, guideId),
    lakeCount: lakes.length,
    pinnedCount: lakes.filter((l) => coords[l.id]).length,
  });
}

const out = {
  generatedFrom:
    "public/fish-manitoba/data.json + public/fishmb/lake-coords.json (FishMB catalogue) and ../bump-board-api/src/data/site/species.json (guides, scientific names, Master Angler minimums). Regenerate: node scripts/build-fishmb-fish-data.mjs",
  species,
  guides,
};
writeFileSync(join(root, "lib", "fishmb-fish-data.json"), JSON.stringify(out, null, 1) + "\n");

console.log(`Manitoba species: ${species.length}`);
for (const s of species) {
  console.log(
    `${s.name} — lakes ${s.lakeCount}, pinned ${s.pinnedCount}, guide ${s.guideId ?? "NONE"}, MA ${s.maMin ?? "—"}`
  );
}
console.log(`Guides carried across: ${Object.keys(guides).length}`);
