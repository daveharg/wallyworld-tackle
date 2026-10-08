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
  status: string;
  review_note: string | null;
  created_at: string;
  captured_at: string | null;
  time_flag: string | null;
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

/** What a non-organizer may see: approved entries plus their own pending ones. */
export async function getEntriesForViewer(
  tournamentId: string,
  viewerId: string | null
): Promise<TournamentEntry[]> {
  await ensureTournamentTables();
  return query<TournamentEntry>(
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
