// FishMB species leaderboards.
//
// Data: public fm_catches rows (visibility='public') + APPROVED
// fm_tournament_entries. Anti-farming rule: for every category, only each
// angler's 4 biggest fish per calendar day count (ROW_NUMBER partitioned by
// user + day, ordered by length desc). Days are computed in America/Winnipeg.

import { query } from "./db";
import { ensureFeedColumns } from "./feed";
import { ensureTournamentTables } from "./tournaments";

/**
 * Master Angler minimum lengths (inches), per Travel Manitoba's official
 * Master Angler program rules:
 * https://anglers.travelmanitoba.com/master-angler-program/rules/
 */
export const MASTER_MINIMUMS: Record<string, number> = {
  Walleye: 28,
  Sauger: 18,
  "Northern Pike": 41,
  "Channel Catfish": 35,
  "Lake Trout": 35,
  "Smallmouth Bass": 18,
  "Largemouth Bass": 18,
  "Black Crappie": 13,
  "Yellow Perch": 13,
  "Lake Whitefish": 22,
  Burbot: 30,
  "Freshwater Drum": 24,
  Goldeye: 14,
  Mooneye: 14,
  "Brook Trout": 20,
  "Brown Trout": 20,
  "Rainbow Trout": 20,
  Splake: 20,
  "Tiger Trout": 20,
  "Arctic Char": 20,
  "Arctic Grayling": 18,
  "Common Carp": 30,
  "Rock Bass": 10,
  "White Bass": 15,
  Sucker: 18,
  Bullhead: 13,
  Sunfish: 7,
  Cisco: 16,
  Tullibee: 16,
  "Lake Sturgeon": 43,
  Muskellunge: 31,
};

const MINIMUM_LOOKUP = new Map(
  Object.entries(MASTER_MINIMUMS).map(([k, v]) => [k.toLowerCase(), v])
);

/** Master Angler minimum (inches) for a species, case-insensitive. Null when the species has no minimum. */
export function masterMinimum(species: string): number | null {
  return MINIMUM_LOOKUP.get(species.trim().toLowerCase()) ?? null;
}

export type LeaderboardCategory = "best" | "biggest" | "most" | "masters" | "above";

export const LEADERBOARD_CATEGORIES: LeaderboardCategory[] = [
  "best",
  "biggest",
  "most",
  "masters",
  "above",
];

export interface LeaderboardRow {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  /** inches for best/biggest, fish count for most/masters/above */
  value: number;
  /** biggest: the species + ISO date of the personal-best fish */
  extra?: { species: string; date: string | null };
}

export interface SpeciesTab {
  key: string; // lowercase species key used for filtering
  display: string; // most common original casing
  count: number; // qualifying fish (after the 4-per-day cap)
}

const DAY_TZ = "America/Winnipeg";
const LIMIT = 100;

/**
 * Shared CTE: every qualifying fish, capped to each angler's 4 biggest
 * per calendar day. Species filter is case-insensitive; pass null for all.
 */
function cappedCte(speciesKey: string | null): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  let speciesFilter = "";
  if (speciesKey) {
    params.push(speciesKey.toLowerCase());
    speciesFilter = `WHERE LOWER(TRIM(f.species)) = $${params.length}`;
  }
  const sql = `
    WITH fish AS (
      SELECT c.user_id, TRIM(c.species) AS species, c.length_in::float AS len,
             COALESCE(c.caught_at, c.created_at) AS ts
        FROM fm_catches c
       WHERE c.visibility = 'public' AND c.length_in IS NOT NULL AND c.length_in > 0
      UNION ALL
      SELECT e.user_id, TRIM(e.species), e.length_inches::float,
             COALESCE(e.captured_at, e.created_at)
        FROM fm_tournament_entries e
       WHERE e.status = 'approved' AND e.length_inches IS NOT NULL AND e.length_inches > 0
    ),
    capped AS (
      SELECT user_id, species, len, ts FROM (
        SELECT f.user_id, f.species, f.len, f.ts,
               ROW_NUMBER() OVER (
                 PARTITION BY f.user_id, (f.ts AT TIME ZONE '${DAY_TZ}')::date
                 ORDER BY f.len DESC
               ) AS rn
          FROM fish f
          ${speciesFilter}
      ) r
      WHERE rn <= 4
    )`;
  return { sql, params };
}

async function ensureAll() {
  await ensureFeedColumns();
  await ensureTournamentTables();
}

export interface LeaderboardOptions {
  species?: string | null; // lowercase key, or null/"all"
  category: LeaderboardCategory;
  minLength?: number; // for "above"
}

export async function getLeaderboard(opts: LeaderboardOptions): Promise<LeaderboardRow[]> {
  await ensureAll();
  const speciesKey =
    opts.species && opts.species !== "all" ? opts.species : null;
  const { sql: cte, params } = cappedCte(speciesKey);

  const joinUsers = `JOIN fm_users u ON u.id = ranked.user_id`;

  let body: string;
  if (opts.category === "best") {
    body = `SELECT ranked.user_id, u.name AS user_name, u.avatar_url,
                   SUM(ranked.len)::float AS value
              FROM (SELECT user_id, len FROM capped) ranked
              ${joinUsers}
             GROUP BY ranked.user_id, u.name, u.avatar_url
             ORDER BY value DESC LIMIT ${LIMIT}`;
  } else if (opts.category === "biggest") {
    body = `SELECT ranked.user_id, u.name AS user_name, u.avatar_url,
                   ranked.len AS value, ranked.species, ranked.ts
              FROM (SELECT DISTINCT ON (user_id) user_id, len, species, ts
                      FROM capped ORDER BY user_id, len DESC, ts DESC) ranked
              ${joinUsers}
             ORDER BY value DESC LIMIT ${LIMIT}`;
  } else if (opts.category === "most") {
    body = `SELECT ranked.user_id, u.name AS user_name, u.avatar_url,
                   COUNT(*)::int AS value
              FROM capped ranked
              ${joinUsers}
             GROUP BY ranked.user_id, u.name, u.avatar_url
             ORDER BY value DESC LIMIT ${LIMIT}`;
  } else if (opts.category === "masters") {
    const values = Object.entries(MASTER_MINIMUMS)
      .map(([sp, min]) => `('${sp.toLowerCase().replace(/'/g, "''")}', ${min})`)
      .join(", ");
    body = `SELECT ranked.user_id, u.name AS user_name, u.avatar_url,
                   COUNT(*)::int AS value
              FROM capped ranked
              JOIN (VALUES ${values}) AS m(sp, minlen)
                ON LOWER(ranked.species) = m.sp AND ranked.len >= m.minlen
              ${joinUsers}
             GROUP BY ranked.user_id, u.name, u.avatar_url
             ORDER BY value DESC LIMIT ${LIMIT}`;
  } else {
    // above
    const minLen = Math.min(Math.max(Number(opts.minLength) || 20, 0), 120);
    params.push(minLen);
    body = `SELECT ranked.user_id, u.name AS user_name, u.avatar_url,
                   COUNT(*)::int AS value
              FROM capped ranked
              ${joinUsers}
             WHERE ranked.len >= $${params.length}
             GROUP BY ranked.user_id, u.name, u.avatar_url
             ORDER BY value DESC LIMIT ${LIMIT}`;
  }

  const rows = await query<{
    user_id: string;
    user_name: string;
    avatar_url: string | null;
    value: string;
    species?: string;
    ts?: string;
  }>(`${cte} ${body}`, params);

  return rows.map((r) => {
    const row: LeaderboardRow = {
      user_id: r.user_id,
      user_name: r.user_name,
      avatar_url: r.avatar_url,
      value: Number(r.value),
    };
    if (opts.category === "biggest") {
      row.extra = {
        species: r.species ?? "",
        date: r.ts ? new Date(r.ts).toISOString() : null,
      };
    }
    return row;
  });
}

/** Species tabs with qualifying-fish counts (after the 4-per-day cap). */
export async function getLeaderboardSpecies(): Promise<SpeciesTab[]> {
  await ensureAll();
  const { sql: cte } = cappedCte(null);
  const rows = await query<{ species: string; n: string }>(
    `${cte} SELECT species, COUNT(*)::int AS n FROM capped GROUP BY species ORDER BY n DESC`
  );
  const merged = new Map<string, { display: string; count: number }>();
  for (const r of rows) {
    const key = r.species.trim().toLowerCase();
    const cur = merged.get(key);
    if (cur) cur.count += Number(r.n);
    else merged.set(key, { display: r.species.trim(), count: Number(r.n) });
  }
  const out: SpeciesTab[] = [];
  merged.forEach((v, key) => out.push({ key, display: v.display, count: v.count }));
  return out.sort((a, b) => b.count - a.count);
}
