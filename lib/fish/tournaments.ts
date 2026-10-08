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

export async function isParticipant(tournamentId: string, userId: string): Promise<boolean> {
  const row = await queryOne(
    `SELECT 1 FROM fm_tournament_participants WHERE tournament_id = $1 AND user_id = $2`,
    [tournamentId, userId]
  );
  return !!row;
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
