// FishMB moderation — content filter, user reports, and user blocks.
//
// Backs the App Store Guideline 1.2 requirements for user-generated content:
//   1. a method for filtering objectionable material from being posted,
//   2. a mechanism to report offensive content (admin queue in
//      /api/fishmb/admin/reports),
//   3. the ability to block abusive users (their content disappears from
//      your feed/comments and neither of you can message the other).

import { query, queryOne } from "./db";

// ---------------------------------------------------------------------------
// Tables (lazy creation, same pattern as the other fm_* modules)
// ---------------------------------------------------------------------------

let ensured = false;
export async function ensureModerationTables(): Promise<void> {
  if (ensured) return;
  await query(
    `CREATE TABLE IF NOT EXISTS fm_blocks (
       blocker_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
       blocked_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
       created_at timestamptz NOT NULL DEFAULT now(),
       PRIMARY KEY (blocker_id, blocked_id),
       CONSTRAINT fm_blocks_no_self CHECK (blocker_id <> blocked_id)
     )`
  );
  await query(
    `CREATE TABLE IF NOT EXISTS fm_reports (
       id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       reporter_id   uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
       target_type   text NOT NULL CHECK (target_type IN ('post','comment','user','story','catch')),
       target_id     text NOT NULL,
       target_user_id uuid REFERENCES fm_users(id) ON DELETE SET NULL,
       reason        text NOT NULL DEFAULT '',
       status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
       created_at    timestamptz NOT NULL DEFAULT now(),
       acted_at      timestamptz,
       acted_by      uuid REFERENCES fm_users(id) ON DELETE SET NULL
     )`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS fm_reports_status_idx ON fm_reports (status, created_at DESC)`
  );
  ensured = true;
}

// ---------------------------------------------------------------------------
// Content filter
// ---------------------------------------------------------------------------

// Curated objectionable terms (profanity + slurs). Matching is token-based
// after normalization, so fishing vocabulary ("bass", "peacock bass", "class")
// never trips it: short/risky words only match as whole tokens, and only the
// unambiguous longer words also match inside a token.
const BLOCKED_WORDS: readonly string[] = [
  "fuck", "fucker", "fucking", "motherfucker", "shit", "bullshit", "bitch",
  "bastard", "asshole", "dickhead", "cunt", "whore", "slut", "pussy",
  "nigger", "nigga", "faggot", "fag", "retard", "retarded", "kike", "spic",
  "chink", "wetback", "tranny", "pedo", "pedophile", "porn", "porno",
  "blowjob", "handjob", "cumshot", "dildo", "molest", "rapist",
];

// Words checked as whole tokens only (never as substrings).
const TOKEN_ONLY: ReadonlySet<string> = new Set([
  "fag", "porn", "cumshot",
]);

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => LEET[ch] ?? ch)
    .join("");
}

/** Collapse 3+ repeated letters to one ("fuuuck" -> "fuck"-ish check aid). */
function squeeze(token: string): string {
  return token.replace(/([a-z])\1{2,}/g, "$1");
}

/** Returns the matched objectionable term, or null when the text is clean. */
export function findObjectionable(text: string | null | undefined): string | null {
  if (!text) return null;
  const norm = normalize(text);
  const tokens = norm.split(/[^a-z]+/).filter(Boolean);
  // Also catch spaced-out spellings ("f u c k"): when the text is mostly
  // single letters, check the joined form against the whole list.
  if (tokens.length > 2 && tokens.every((t) => t.length <= 2)) {
    const joined = tokens.join("");
    for (const word of BLOCKED_WORDS) {
      if (joined.includes(word)) return word;
    }
    tokens.push(joined);
  }
  // Runs of 3+ single-letter tokens ("f u c k off") — join the run and check.
  let run: string[] = [];
  const runs: string[] = [];
  for (const t of tokens) {
    if (t.length === 1) run.push(t);
    else {
      if (run.length >= 3) runs.push(run.join(""));
      run = [];
    }
  }
  if (run.length >= 3) runs.push(run.join(""));
  for (const joined of runs) {
    for (const word of BLOCKED_WORDS) {
      if (joined.includes(word)) return word;
    }
  }
  for (const token of tokens) {
    const candidates = [token, squeeze(token)];
    for (const word of BLOCKED_WORDS) {
      for (const cand of candidates) {
        if (cand === word) return word;
        if (!TOKEN_ONLY.has(word) && word.length >= 5 && cand.includes(word)) return word;
      }
    }
  }
  return null;
}

export const OBJECTIONABLE_ERROR =
  "That wording isn't allowed on FishMB — clean it up and try again.";

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  await ensureModerationTables();
  await query(
    `INSERT INTO fm_blocks (blocker_id, blocked_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [blockerId, blockedId]
  );
  // Blocking severs the social graph both ways so neither side keeps
  // friend/follow access to the other.
  await query(
    `DELETE FROM fm_friendships
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)`,
    [blockerId, blockedId]
  );
  try {
    await query(
      `DELETE FROM fm_follows
        WHERE (follower_id = $1 AND followee_id = $2)
           OR (follower_id = $2 AND followee_id = $1)`,
      [blockerId, blockedId]
    );
  } catch {
    // fm_follows may not exist yet on a fresh database.
  }
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await ensureModerationTables();
  await query(`DELETE FROM fm_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [
    blockerId,
    blockedId,
  ]);
}

export interface BlockedUser {
  id: string;
  name: string;
  avatar_url: string | null;
  blocked_at: string;
}

export async function listBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
  await ensureModerationTables();
  return query<BlockedUser>(
    `SELECT u.id, u.name, u.avatar_url, b.created_at AS blocked_at
       FROM fm_blocks b JOIN fm_users u ON u.id = b.blocked_id
      WHERE b.blocker_id = $1
      ORDER BY b.created_at DESC`,
    [blockerId]
  );
}

/** True when either user has blocked the other. */
export async function blockedEitherWay(a: string, b: string): Promise<boolean> {
  await ensureModerationTables();
  const row = await queryOne<{ ok: boolean }>(
    `SELECT true AS ok FROM fm_blocks
      WHERE (blocker_id = $1 AND blocked_id = $2)
         OR (blocker_id = $2 AND blocked_id = $1)
      LIMIT 1`,
    [a, b]
  );
  return !!row;
}

/** Author ids whose content should be hidden from this viewer (both
 *  directions of a block hide content). Empty array = hide nobody. */
export async function hiddenAuthorIds(viewerId: string | null): Promise<string[]> {
  if (!viewerId) return [];
  await ensureModerationTables();
  const rows = await query<{ id: string }>(
    `SELECT blocked_id AS id FROM fm_blocks WHERE blocker_id = $1
     UNION
     SELECT blocker_id AS id FROM fm_blocks WHERE blocked_id = $1`,
    [viewerId]
  );
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export type ReportTargetType = "post" | "comment" | "user" | "story" | "catch";

/** Resolve who authored the reported thing (null when it can't be found). */
async function resolveTargetAuthor(
  type: ReportTargetType,
  targetId: string
): Promise<string | null> {
  if (type === "user") return targetId;
  const table =
    type === "post"
      ? "fm_discussions"
      : type === "comment"
        ? "fm_comments"
        : type === "story"
          ? "fm_stories"
          : "fm_catches";
  try {
    const row = await queryOne<{ user_id: string }>(
      `SELECT user_id FROM ${table} WHERE id = $1`,
      [targetId]
    );
    return row?.user_id ?? null;
  } catch {
    return null;
  }
}

export async function createReport(
  reporterId: string,
  type: ReportTargetType,
  targetId: string,
  reason: string
): Promise<{ targetUserId: string | null }> {
  await ensureModerationTables();
  const targetUserId = await resolveTargetAuthor(type, targetId);
  await query(
    `INSERT INTO fm_reports (reporter_id, target_type, target_id, target_user_id, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [reporterId, type, targetId, targetUserId, reason.slice(0, 500)]
  );
  return { targetUserId };
}
