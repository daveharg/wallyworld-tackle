// Fish Manitoba tournaments — organizer-run fishing tournaments.
//
// Tables are created idempotently on first use (CREATE TABLE IF NOT EXISTS),
// so no manual migration step is needed.
//
// Anti-cheat, enforced at the API layer:
//  1. Server timestamp — entries carry the DB's now() as the official catch
//     time. Anglers cannot backdate; entries are only accepted while the
//     tournament is live (server clock).
//  2. GPS stamp — latitude/longitude/accuracy are recorded per entry and shown
//     to the organizer (with a map link). Coordinates outside Manitoba's
//     bounding box are rejected.
//  3. Photo required — every entry needs a photo (Vercel Blob URL). A SHA-256
//     hash of the image bytes is stored; a photo already submitted in the
//     same tournament is flagged as a duplicate for the organizer.
//  4. Organizer review — entries start as "pending" and only "approved"
//     entries count on the leaderboard. The organizer can reject with a note
//     (disqualification).

import { randomBytes } from "crypto";
import { query, queryOne } from "./db";

/**
 * Perceptual hash (pHash) for near-duplicate photo detection.
 * Downscales to 8x8 grayscale and hashes against the mean — two photos of
 * the same fish from slightly different angles produce similar hashes,
 * unlike SHA-256 which changes completely. Returns a 16-char hex string.
 */
export async function computePHash(buf: Buffer): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(buf)
      .resize(8, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (data.length < 64) return null;
    let sum = 0;
    for (let i = 0; i < 64; i++) sum += data[i];
    const avg = sum / 64;
    let hash = BigInt(0);
    for (let i = 0; i < 64; i++) {
      if (data[i] > avg) hash |= BigInt(1) << BigInt(i);
    }
    return hash.toString(16).padStart(16, "0");
  } catch {
    return null;
  }
}

/** Hamming distance between two 16-char hex pHashes (0–64). */
export function phashDistance(a: string, b: string): number {
  try {
    let x = BigInt("0x" + a) ^ BigInt("0x" + b);
    let d = 0;
    while (x) {
      d += Number(x & BigInt(1));
      x >>= BigInt(1);
    }
    return d;
  } catch {
    return 64;
  }
}

/** Max Hamming distance to consider two photos "possibly the same fish". */
export const PHASH_SIMILARITY_THRESHOLD = 12;

export interface PayoutTier {
  place: number;
  type: "percent" | "amount";
  value: number; // percent of pot (0-100) or dollars
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  organizer_id: string;
  organizer_name: string;
  lake_ids: string[];
  species: string[];
  starts_at: string;
  ends_at: string;
  rules: string;
  scoring: string;
  invite_code: string;
  status: string;
  max_participants: number | null;
  entry_fee_cents: number;
  payouts: PayoutTier[];
  auto_approve_entries: boolean;
  photo_mode: string;
  hide_locations: boolean;
  participants_seen_at: string | null;
  cover_photo_url: string | null;
  venue_name: string | null;
  venue_address: string | null;
  created_at: string;
  participant_count: number;
  entry_count: number;
}

export interface TournamentEntry {
  id: string;
  tournament_id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  photo_url: string;
  photo_urls: string[];
  species: string;
  length_inches: number | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  notes: string;
  duplicate_of: string | null;
  photo_phash: string | null;
  similar_photo_of: string | null;
  similar_catch_of: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  captured_at: string | null;
  time_flag: string | null;
  lake_distance_km: number | null;
  location_flag: string | null;
  /** Present when locations are hidden: confirms the catch was GPS-verified in-area. */
  location_verified?: boolean;
}

let ensured = false;

export async function ensureTournamentTables(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_tournaments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    organizer_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    lake_ids text[] NOT NULL DEFAULT '{}',
    species text[] NOT NULL DEFAULT '{}',
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    rules text NOT NULL DEFAULT '',
    scoring text NOT NULL DEFAULT 'longest',
    invite_code text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'upcoming',
    max_participants int,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS fm_tournament_participants (
    tournament_id uuid NOT NULL REFERENCES fm_tournaments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tournament_id, user_id)
  )`);
  // Single-use entry keys: the organizer generates codes and hands one to each
  // angler after they pay (payment itself stays off-platform/manual). Each key
  // joins exactly one angler, once.
  await query(`CREATE TABLE IF NOT EXISTS fm_tournament_keys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES fm_tournaments(id) ON DELETE CASCADE,
    key_code text UNIQUE NOT NULL,
    status text NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used')),
    used_by_user_id uuid REFERENCES fm_users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    used_at timestamptz
  )`);
  await query(`CREATE INDEX IF NOT EXISTS fm_tournament_keys_tourney_idx ON fm_tournament_keys(tournament_id, status)`);
  // Named + shared keys: label tracks which angler a key was issued to;
  // max_uses NULL = one shared key with unlimited redemptions (each angler
  // still joins only once); uses counts redemptions atomically.
  await query(`ALTER TABLE fm_tournament_keys ADD COLUMN IF NOT EXISTS label TEXT`);
  await query(`ALTER TABLE fm_tournament_keys ADD COLUMN IF NOT EXISTS max_uses INT DEFAULT 1`);
  await query(`ALTER TABLE fm_tournament_keys ADD COLUMN IF NOT EXISTS uses INT NOT NULL DEFAULT 0`);
  await query(`UPDATE fm_tournament_keys SET uses = 1 WHERE status = 'used' AND uses = 0`);
  // Redemption log: who used which key (matters for shared keys).
  await query(`CREATE TABLE IF NOT EXISTS fm_tournament_key_redemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id uuid NOT NULL REFERENCES fm_tournament_keys(id) ON DELETE CASCADE,
    tournament_id uuid NOT NULL REFERENCES fm_tournaments(id) ON DELETE CASCADE,
    user_id uuid REFERENCES fm_users(id) ON DELETE SET NULL,
    redeemed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (key_id, user_id)
  )`);
  await query(`INSERT INTO fm_tournament_key_redemptions (key_id, tournament_id, user_id, redeemed_at)
    SELECT id, tournament_id, used_by_user_id, COALESCE(used_at, created_at)
    FROM fm_tournament_keys
    WHERE status = 'used' AND used_by_user_id IS NOT NULL
    ON CONFLICT (key_id, user_id) DO NOTHING`);
  await query(`CREATE TABLE IF NOT EXISTS fm_tournament_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES fm_tournaments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    photo_url text NOT NULL,
    species text NOT NULL,
    length_inches numeric,
    latitude double precision,
    longitude double precision,
    gps_accuracy double precision,
    notes text NOT NULL DEFAULT '',
    photo_hash text,
    duplicate_of uuid REFERENCES fm_tournament_entries(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending',
    reviewed_by uuid REFERENCES fm_users(id),
    reviewed_at timestamptz,
    review_note text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  // Offline app support: the phone's capture timestamp + any clock-tamper flag.
  await query(`ALTER TABLE fm_tournament_entries ADD COLUMN IF NOT EXISTS captured_at timestamptz`);
  await query(`ALTER TABLE fm_tournament_entries ADD COLUMN IF NOT EXISTS time_flag text`);
  // Lake-boundary enforcement: distance from the entry GPS to the nearest
  // tournament lake center + a review flag when it's outside lake waters.
  await query(`ALTER TABLE fm_tournament_entries ADD COLUMN IF NOT EXISTS lake_distance_km numeric`);
  await query(`ALTER TABLE fm_tournament_entries ADD COLUMN IF NOT EXISTS location_flag text`);
  // Entry-fee tracking: the organizer marks each participant paid (payment
  // itself stays manual/off-platform — FishMB never touches the money).
  await query(`ALTER TABLE fm_tournament_participants ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false`);
  await query(`ALTER TABLE fm_tournament_participants ADD COLUMN IF NOT EXISTS paid_at timestamptz`);
  await query(`ALTER TABLE fm_tournament_participants ADD COLUMN IF NOT EXISTS paid_marked_by uuid REFERENCES fm_users(id)`);
  // Organizer dashboard: check-in on tournament day + private organizer notes.
  await query(`ALTER TABLE fm_tournament_participants ADD COLUMN IF NOT EXISTS checked_in boolean NOT NULL DEFAULT false`);
  await query(`ALTER TABLE fm_tournament_participants ADD COLUMN IF NOT EXISTS checked_in_at timestamptz`);
  await query(`ALTER TABLE fm_tournament_participants ADD COLUMN IF NOT EXISTS organizer_note text NOT NULL DEFAULT ''`);
  // Multi-photo catches: primary photo stays in photo_url; all photos (1-4) in photo_urls.
  await query(`ALTER TABLE fm_tournament_entries ADD COLUMN IF NOT EXISTS photo_urls jsonb NOT NULL DEFAULT '[]'`);
  await query(`UPDATE fm_tournament_entries SET photo_urls = jsonb_build_array(photo_url) WHERE photo_urls = '[]' OR jsonb_array_length(photo_urls) = 0`);
  // Money: entry fee in cents + payout structure (JSON array of {place,type:'percent'|'amount',value}).
  await query(`ALTER TABLE fm_tournaments ADD COLUMN IF NOT EXISTS entry_fee_cents int NOT NULL DEFAULT 0`);
  await query(`ALTER TABLE fm_tournaments ADD COLUMN IF NOT EXISTS payouts jsonb NOT NULL DEFAULT '[]'`);
  // Friendly/demo tournaments can skip organizer review (Dave's call — real
  // tournaments keep manual approval as the anti-cheat default).
  await query(`ALTER TABLE fm_tournaments ADD COLUMN IF NOT EXISTS auto_approve_entries boolean NOT NULL DEFAULT false`);
  // Richer tournament pages: cover photo, venue name + address.
  await query(`ALTER TABLE fm_tournaments ADD COLUMN IF NOT EXISTS cover_photo_url text`);
  await query(`ALTER TABLE fm_tournaments ADD COLUMN IF NOT EXISTS venue_name text`);
  await query(`ALTER TABLE fm_tournaments ADD COLUMN IF NOT EXISTS venue_address text`);
  // Photo mode: 'standard' (organizer's photo rules) or 'measure_only'
  // (friendly tournaments — just the fish on the measuring board, no posed
  // photo with the fish required; extra photos stay optional).
  await query(`ALTER TABLE fm_tournaments ADD COLUMN IF NOT EXISTS photo_mode text NOT NULL DEFAULT 'standard'`);
  // Location privacy: when true, exact catch GPS is hidden from other anglers
  // (organizer still sees it for verification); everyone else only sees that
  // the catch was confirmed inside the tournament area.
  await query(`ALTER TABLE fm_tournaments ADD COLUMN IF NOT EXISTS hide_locations boolean NOT NULL DEFAULT false`);
  // Organizer notification watermark: new joins after this timestamp count as
  // "new" until the organizer opens the manage page.
  await query(`ALTER TABLE fm_tournaments ADD COLUMN IF NOT EXISTS participants_seen_at timestamptz`);
  // One-time repair: the seeded demo's posted rules say entries are
  // auto-approved, so honor that and clear the stuck "pending" backlog.
  // (Organizer ownership is left alone — it isn't needed for this fix.)
  await query(`
    UPDATE fm_tournaments
       SET auto_approve_entries = true
     WHERE UPPER(invite_code) = 'DEMO12'
       AND auto_approve_entries = false
  `);
  await query(`
    UPDATE fm_tournament_entries e
       SET status = 'approved'
      FROM fm_tournaments t
     WHERE e.tournament_id = t.id
       AND UPPER(t.invite_code) = 'DEMO12'
       AND e.status = 'pending'
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_tournament_entries_tournament_idx ON fm_tournament_entries(tournament_id, status)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_tournament_entries_hash_idx ON fm_tournament_entries(tournament_id, photo_hash)`
  );
  // Perceptual-hash + similar-catch flags (same-fish detection).
  await query(`ALTER TABLE fm_tournament_entries ADD COLUMN IF NOT EXISTS photo_phash text`);
  await query(`ALTER TABLE fm_tournament_entries ADD COLUMN IF NOT EXISTS similar_photo_of uuid REFERENCES fm_tournament_entries(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE fm_tournament_entries ADD COLUMN IF NOT EXISTS similar_catch_of uuid REFERENCES fm_tournament_entries(id) ON DELETE SET NULL`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_tournament_entries_phash_idx ON fm_tournament_entries(tournament_id, photo_phash)`
  );
  ensured = true;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export async function generateInviteCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const bytes = randomBytes(6);
    let code = "";
    for (let j = 0; j < bytes.length; j++) code += CODE_ALPHABET[bytes[j] % CODE_ALPHABET.length];
    const clash = await queryOne(`SELECT id FROM fm_tournaments WHERE invite_code = $1`, [code]);
    if (!clash) return code;
  }
  throw new Error("Could not generate an invite code.");
}

/** Manitoba bounding box sanity check for a GPS fix. */
export function gpsInManitoba(lat: number, lng: number): boolean {
  return lat >= 48.9 && lat <= 60.1 && lng >= -102.1 && lng <= -88.9;
}

// Lake-boundary enforcement. Tournaments run on specific water: each entry's
// GPS is measured against the tournament's chosen lake(s) using the verified
// lake center points (public/fishmb/lake-coords.json). There are no lake
// boundary polygons in the data, so this is a center-distance check — entries
// beyond LAKE_BOUNDARY_KM are FLAGGED for organizer review, never
// auto-rejected (giant lakes like Winnipeg span far beyond any radius).
export const LAKE_BOUNDARY_KM = 30;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

let lakeCentersCache: Record<string, { lat: number; lng: number; name?: string }> | null = null;
function lakeCenters(): Record<string, { lat: number; lng: number; name?: string }> {
  if (!lakeCentersCache) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      lakeCentersCache = require("@/public/fishmb/lake-coords.json");
    } catch {
      lakeCentersCache = {};
    }
  }
  return lakeCentersCache!;
}

/** Nearest tournament lake to a GPS point, or null when none have coordinates. */
export function nearestTournamentLake(
  lat: number,
  lng: number,
  lakeIds: string[]
): { lakeId: string; lakeName: string; km: number } | null {
  const centers = lakeCenters();
  let best: { lakeId: string; lakeName: string; km: number } | null = null;
  for (const id of lakeIds) {
    const c = centers[id];
    if (!c || typeof c.lat !== "number" || typeof c.lng !== "number") continue;
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (!best || km < best.km) {
      best = { lakeId: id, lakeName: c.name ?? id, km };
    }
  }
  return best;
}

export interface TournamentParticipant {
  user_id: string;
  name: string;
  avatar_url: string | null;
  joined_at: string;
  paid: boolean;
  paid_at: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  organizer_note: string;
  key_code: string | null;
  key_label: string | null;
}

/** Organizer-only participant list with entry-fee payment status, check-in,
 *  and which invite key each angler used (auto-linked at redemption). */
export async function listParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  await ensureTournamentTables();
  return query<TournamentParticipant>(
    `SELECT p.user_id, u.name, u.avatar_url, p.joined_at, p.paid, p.paid_at,
            p.checked_in, p.checked_in_at, p.organizer_note,
            k.key_code, k.label AS key_label
       FROM fm_tournament_participants p
       JOIN fm_users u ON u.id = p.user_id
       LEFT JOIN fm_tournament_key_redemptions r
         ON r.tournament_id = p.tournament_id AND r.user_id = p.user_id
       LEFT JOIN fm_tournament_keys k ON k.id = r.key_id
      WHERE p.tournament_id = $1
      ORDER BY p.joined_at ASC`,
    [tournamentId]
  );
}

/** Organizer marks a participant's entry fee paid/unpaid (money stays manual/off-platform). */
export async function setParticipantPaid(
  tournamentId: string,
  userId: string,
  paid: boolean,
  markedBy: string
): Promise<TournamentParticipant | null> {
  await ensureTournamentTables();
  const rows = await query<TournamentParticipant>(
    `UPDATE fm_tournament_participants
        SET paid = $3,
            paid_at = CASE WHEN $3 THEN now() ELSE NULL END,
            paid_marked_by = $4
      WHERE tournament_id = $1 AND user_id = $2
      RETURNING user_id, joined_at, paid, paid_at,
        (SELECT name FROM fm_users WHERE id = fm_tournament_participants.user_id) AS name,
        (SELECT avatar_url FROM fm_users WHERE id = fm_tournament_participants.user_id) AS avatar_url`,
    [tournamentId, userId, paid, markedBy]
  );
  return rows[0] ?? null;
}

/** Organizer marks a participant checked-in (tournament day). */
export async function setParticipantCheckedIn(
  tournamentId: string,
  userId: string,
  checkedIn: boolean
): Promise<boolean> {
  await ensureTournamentTables();
  const rows = await query<{ user_id: string }>(
    `UPDATE fm_tournament_participants
        SET checked_in = $3,
            checked_in_at = CASE WHEN $3 THEN now() ELSE NULL END
      WHERE tournament_id = $1 AND user_id = $2
      RETURNING user_id`,
    [tournamentId, userId, checkedIn]
  );
  return rows.length > 0;
}

/** Organizer saves a private note on a participant (only the organizer sees it). */
export async function setParticipantNote(
  tournamentId: string,
  userId: string,
  note: string
): Promise<boolean> {
  await ensureTournamentTables();
  const rows = await query<{ user_id: string }>(
    `UPDATE fm_tournament_participants SET organizer_note = $3
      WHERE tournament_id = $1 AND user_id = $2
      RETURNING user_id`,
    [tournamentId, userId, note.slice(0, 500)]
  );
  return rows.length > 0;
}

/** Organizer removes a participant (also removes their key redemption). */
export async function removeParticipant(
  tournamentId: string,
  userId: string
): Promise<boolean> {
  await ensureTournamentTables();
  await query(
    `DELETE FROM fm_tournament_key_redemptions WHERE tournament_id = $1 AND user_id = $2`,
    [tournamentId, userId]
  );
  const rows = await query<{ user_id: string }>(
    `DELETE FROM fm_tournament_participants WHERE tournament_id = $1 AND user_id = $2
     RETURNING user_id`,
    [tournamentId, userId]
  );
  return rows.length > 0;
}

/** What a participant sees about their own entry-fee payment. */
export async function getMyPaymentStatus(
  tournamentId: string,
  userId: string
): Promise<{ paid: boolean; paid_at: string | null } | null> {
  await ensureTournamentTables();
  return queryOne<{ paid: boolean; paid_at: string | null }>(
    `SELECT paid, paid_at FROM fm_tournament_participants WHERE tournament_id = $1 AND user_id = $2`,
    [tournamentId, userId]
  );
}

const TOURNAMENT_SELECT = `
  SELECT t.*, u.name AS organizer_name,
    (SELECT COUNT(*) FROM fm_tournament_participants p WHERE p.tournament_id = t.id)::int AS participant_count,
    (SELECT COUNT(*) FROM fm_tournament_entries e WHERE e.tournament_id = t.id AND e.status = 'approved')::int AS entry_count
  FROM fm_tournaments t
  JOIN fm_users u ON u.id = t.organizer_id
`;

export async function getTournament(id: string): Promise<Tournament | null> {
  await ensureTournamentTables();
  return queryOne<Tournament>(`${TOURNAMENT_SELECT} WHERE t.id = $1`, [id]);
}

export async function getTournamentByInvite(code: string): Promise<Tournament | null> {
  await ensureTournamentTables();
  return queryOne<Tournament>(`${TOURNAMENT_SELECT} WHERE t.invite_code = $1`, [code.toUpperCase()]);
}

export async function listTournaments(): Promise<Tournament[]> {
  await ensureTournamentTables();
  return query<Tournament>(`${TOURNAMENT_SELECT} ORDER BY t.starts_at ASC`);
}

/** Published tournaments (upcoming or running) for the homepage list. */
export async function listPublicTournaments(): Promise<Tournament[]> {
  await ensureTournamentTables();
  return query<Tournament>(
    `${TOURNAMENT_SELECT} WHERE t.status IN ('upcoming', 'active') ORDER BY t.starts_at ASC LIMIT 12`
  );
}

/** Tournaments organized by one user, newest first. */
export async function getMyTournaments(userId: string): Promise<Tournament[]> {
  await ensureTournamentTables();
  return query<Tournament>(
    `${TOURNAMENT_SELECT} WHERE t.organizer_id = $1 ORDER BY t.starts_at DESC`,
    [userId]
  );
}

export async function isParticipant(tournamentId: string, userId: string): Promise<boolean> {
  const row = await queryOne(
    `SELECT 1 FROM fm_tournament_participants WHERE tournament_id = $1 AND user_id = $2`,
    [tournamentId, userId]
  );
  return !!row;
}

export interface TournamentKeyRedeemer {
  user_id: string;
  name: string | null;
  redeemed_at: string;
}
export interface TournamentKey {
  id: string;
  tournament_id: string;
  key_code: string;
  status: "unused" | "used";
  label: string | null;
  max_uses: number | null;
  uses: number;
  used_by_user_id: string | null;
  used_by_name: string | null;
  created_at: string;
  used_at: string | null;
  redeemers: TournamentKeyRedeemer[];
}

const TOURNAMENT_KEY_COLS = `id, tournament_id, key_code, status, label, max_uses, uses,
  used_by_user_id, NULL::text AS used_by_name, created_at, used_at,
  '[]'::json AS redeemers`;

// 8-char uppercase alphanumeric, skipping confusing 0/O/1/I.
const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomKeyCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)];
  }
  return s;
}

/** Generate entry keys for a tournament. Retries on unique code collisions.
 *  `{ shared: true }` → one unlimited-use key; `{ labels }` → one labeled
 *  one-time key per name; otherwise `{ count }` unlabeled one-time keys. */
export async function generateTournamentKeys(
  tournamentId: string,
  opts: { count?: number; labels?: string[]; shared?: boolean }
): Promise<TournamentKey[]> {
  await ensureTournamentTables();
  // One shared key (unlimited uses), one labeled key per name, or N unlabeled keys.
  const specs: { label: string | null; maxUses: number | null }[] = [];
  if (opts.shared) {
    specs.push({ label: "Shared key", maxUses: null });
  } else if (opts.labels && opts.labels.length > 0) {
    for (const raw of opts.labels.slice(0, 200)) {
      const label = raw.trim().slice(0, 80);
      if (label) specs.push({ label, maxUses: 1 });
    }
  } else {
    const n = Math.max(1, Math.min(200, Math.floor(opts.count ?? 0)));
    for (let i = 0; i < n; i++) specs.push({ label: null, maxUses: 1 });
  }
  const made: TournamentKey[] = [];
  for (const spec of specs) {
    let row: TournamentKey | null = null;
    for (let attempt = 0; attempt < 10 && !row; attempt++) {
      try {
        row = await queryOne<TournamentKey>(
          `INSERT INTO fm_tournament_keys (tournament_id, key_code, label, max_uses) VALUES ($1, $2, $3, $4)
           RETURNING ${TOURNAMENT_KEY_COLS}`,
          [tournamentId, randomKeyCode(), spec.label, spec.maxUses]
        );
      } catch {
        row = null; // unique collision — try another code
      }
    }
    if (row) made.push(row);
  }
  return made;
}

/** List a tournament's keys (organizer view), newest first. */
export async function listTournamentKeys(tournamentId: string): Promise<TournamentKey[]> {
  await ensureTournamentTables();
  return query<TournamentKey>(
    `SELECT k.id, k.tournament_id, k.key_code, k.status, k.label, k.max_uses, k.uses,
            k.used_by_user_id, u.name AS used_by_name, k.created_at, k.used_at,
            COALESCE(
              (SELECT json_agg(
                 json_build_object('user_id', r.user_id, 'name', ru.name, 'redeemed_at', r.redeemed_at)
                 ORDER BY r.redeemed_at
               )
               FROM fm_tournament_key_redemptions r
               LEFT JOIN fm_users ru ON ru.id = r.user_id
               WHERE r.key_id = k.id),
              '[]'
            ) AS redeemers
     FROM fm_tournament_keys k
     LEFT JOIN fm_users u ON u.id = k.used_by_user_id
     WHERE k.tournament_id = $1
     ORDER BY k.created_at DESC`,
    [tournamentId]
  );
}

/**
 * Redeem an entry key: claims one use atomically and adds the user as a
 * participant. Single-use keys (max_uses=1) transition to 'used' as before;
 * shared keys (max_uses NULL) accept unlimited redemptions. Returns
 * { ok, tournament_id } or { error }.
 */
export async function redeemTournamentKey(
  tournamentId: string,
  rawKey: string,
  userId: string
): Promise<{ tournament_id?: string; error?: string }> {
  await ensureTournamentTables();
  const code = rawKey.trim().toUpperCase();
  if (!code) return { error: "Enter your entry key." };
  if (await isParticipant(tournamentId, userId)) {
    return { error: "You're already in this tournament." };
  }
  const t = await getTournament(tournamentId);
  if (!t) return { error: "Tournament not found." };
  if (t.max_participants !== null && t.participant_count >= t.max_participants) {
    return { error: "This tournament is full." };
  }
  // Atomically claim one use. The uses < max_uses condition is checked
  // directly on the row (not in a subselect) so concurrent redeemers serialize
  // on the row lock and the condition is re-checked against the latest row.
  const claimed = await queryOne<{ id: string }>(
    `UPDATE fm_tournament_keys
     SET uses = uses + 1,
         status = CASE WHEN max_uses IS NULL THEN status ELSE 'used' END,
         used_by_user_id = CASE WHEN max_uses IS NULL THEN used_by_user_id ELSE $3 END,
         used_at = CASE WHEN max_uses IS NULL THEN used_at ELSE now() END
     WHERE tournament_id = $1 AND key_code = $2
       AND (max_uses IS NULL OR uses < max_uses)
     RETURNING id`,
    [tournamentId, code, userId]
  );
  if (!claimed) return { error: "That key isn't valid or was already used." };
  await query(
    `INSERT INTO fm_tournament_key_redemptions (key_id, tournament_id, user_id)
     VALUES ($1, $2, $3) ON CONFLICT (key_id, user_id) DO NOTHING`,
    [claimed.id, tournamentId, userId]
  );
  await query(
    `INSERT INTO fm_tournament_participants (tournament_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [tournamentId, userId]
  );
  return { tournament_id: tournamentId };
}

export async function getEntries(tournamentId: string, statuses: string[]): Promise<TournamentEntry[]> {
  await ensureTournamentTables();
  return query<TournamentEntry>(
    `SELECT e.*, u.name AS user_name, u.avatar_url,
       (SELECT d.id FROM fm_tournament_entries d
         WHERE d.tournament_id = e.tournament_id AND d.photo_hash = e.photo_hash
           AND d.id <> e.id AND d.created_at < e.created_at
         ORDER BY d.created_at ASC LIMIT 1) AS duplicate_of
     FROM fm_tournament_entries e
     JOIN fm_users u ON u.id = e.user_id
     WHERE e.tournament_id = $1 AND e.status = ANY($2)
     ORDER BY e.created_at DESC`,
    [tournamentId, statuses]
  );
}

/** What a non-organizer may see: approved entries plus their own pending ones.
 *  When the tournament hides locations, exact GPS is stripped for everyone
 *  except the entry's owner — others only see the in-area verification. */
export async function getEntriesForViewer(
  tournamentId: string,
  viewerId: string | null,
  hideLocations = false
): Promise<TournamentEntry[]> {
  await ensureTournamentTables();
  const rows = await query<TournamentEntry>(
    `SELECT e.*, u.name AS user_name, u.avatar_url,
       (SELECT d.id FROM fm_tournament_entries d
         WHERE d.tournament_id = e.tournament_id AND d.photo_hash = e.photo_hash
           AND d.id <> e.id AND d.created_at < e.created_at
         ORDER BY d.created_at ASC LIMIT 1) AS duplicate_of
     FROM fm_tournament_entries e
     JOIN fm_users u ON u.id = e.user_id
     WHERE e.tournament_id = $1
       AND (e.status = 'approved' OR ($2::uuid IS NOT NULL AND e.user_id = $2::uuid AND e.status = 'pending'))
     ORDER BY e.created_at DESC`,
    [tournamentId, viewerId]
  );
  if (!hideLocations) return rows;
  // Strip exact GPS for other anglers' entries; keep the area confirmation.
  return rows.map((r) => {
    const own = viewerId !== null && r.user_id === viewerId;
    if (own) return r;
    return {
      ...r,
      latitude: null,
      longitude: null,
      gps_accuracy: null,
      location_verified: r.latitude !== null && r.longitude !== null,
    } as TournamentEntry;
  });
}

export interface LeaderboardRow {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  fish_count: number;
  best_length: number | null;
  total_length: number;
  score: number;
}

/** Leaderboard from approved entries. Scoring: longest | total | count. */
export async function getLeaderboard(tournamentId: string, scoring: string): Promise<LeaderboardRow[]> {
  await ensureTournamentTables();
  const rows = await query<LeaderboardRow>(
    `SELECT e.user_id, u.name AS user_name, u.avatar_url,
       COUNT(*)::int AS fish_count,
       MAX(e.length_inches)::float AS best_length,
       COALESCE(SUM(e.length_inches), 0)::float AS total_length,
       CASE WHEN $2 = 'total' THEN COALESCE(SUM(e.length_inches), 0)::float
            WHEN $2 = 'count' THEN COUNT(*)::float
            ELSE COALESCE(MAX(e.length_inches), 0)::float END AS score
     FROM fm_tournament_entries e
     JOIN fm_users u ON u.id = e.user_id
     WHERE e.tournament_id = $1 AND e.status = 'approved'
     GROUP BY e.user_id, u.name, u.avatar_url
     ORDER BY score DESC, fish_count DESC`,
    [tournamentId, scoring]
  );
  return rows;
}
