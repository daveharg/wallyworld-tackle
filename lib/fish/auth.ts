// Fish Manitoba backend — session auth helpers.
//
// Mobile clients authenticate with a Bearer session token obtained from
// POST /api/fish/auth/google. Tokens are 64-char hex strings, valid 30 days.
// Tokens are never logged.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { query, queryOne, txQueryOne } from "./db";
import type { PoolClient } from "pg";

export interface FishUser {
  id: string;
  google_sub: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  stats_public: boolean;
  play_balance: number;
  bio: string;
  created_at: string;
}

export interface PublicUser {
  id: string;
  name: string;
  avatar_url: string | null;
}

export function publicUser(u: FishUser): PublicUser {
  return { id: u.id, name: u.name, avatar_url: u.avatar_url };
}

/** True when the user signed up anonymously (no Google account linked yet). */
export function isAnonymousUser(u: { google_sub: string }): boolean {
  return u.google_sub.startsWith("anon:");
}

/** Public API shape for a user, returned by the auth/me endpoints. */
export interface ApiUser {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  stats_public: boolean;
  play_balance: number;
  bio: string;
  is_anonymous: boolean;
  created_at: string;
}

export function toApiUser(u: FishUser): ApiUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatar_url: u.avatar_url,
    stats_public: u.stats_public,
    bio: (u as { bio?: string }).bio ?? "", 
    play_balance: u.play_balance,
    is_anonymous: isAnonymousUser(u),
    created_at: u.created_at,
  };
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getBearerToken(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+([0-9a-fA-F]{64})$/.exec(h.trim());
  return m ? m[1].toLowerCase() : null;
}

/** Authenticated user or null. Never throws on missing/invalid token. */
export async function fishUserFromRequest(
  req: NextRequest
): Promise<FishUser | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  return queryOne<FishUser>(
    `SELECT u.* FROM fm_users u
       JOIN fm_sessions s ON s.user_id = u.id
      WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
}

export function unauthorized() {
  return NextResponse.json({ error: "Sign in required." }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function forbidden(message = "Not allowed.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found.") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Create a session row and return the raw token (shown to the client once). */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await query(
    `INSERT INTO fm_sessions (token, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(secs => $3))`,
    [token, userId, SESSION_TTL_MS / 1000]
  );
  return token;
}

/** Prune expired sessions opportunistically (fire-and-forget). */
export function pruneExpiredSessions(): void {
  query(`DELETE FROM fm_sessions WHERE expires_at < now() - interval '7 days'`).catch(
    () => {}
  );
}

/** True if a and b are accepted friends (either direction). */
export async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const row = await queryOne<{ n: string }>(
    `SELECT 1 AS n FROM fm_friendships
      WHERE status = 'accepted'
        AND ((requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1))
      LIMIT 1`,
    [a, b]
  );
  return row !== null;
}

/** Adjust a user's play-money balance and write the ledger row atomically. */
export async function adjustBalance(
  client: PoolClient,
  userId: string,
  amount: number,
  reason: "contest_entry" | "contest_win" | "signup_bonus" | "adjustment",
  contestId: string | null
): Promise<number> {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error("amount must be a non-zero integer");
  }
  const row = await txQueryOne<{ play_balance: number }>(
    client,
    `UPDATE fm_users SET play_balance = play_balance + $2
      WHERE id = $1 RETURNING play_balance`,
    [userId, amount]
  );
  if (!row) throw new Error("user not found");
  if (row.play_balance < 0) throw new Error("insufficient play-money balance");
  await txQueryOne(
    client,
    `INSERT INTO fm_ledger (user_id, contest_id, amount, reason)
     VALUES ($1, $2, $3, $4)`,
    [userId, contestId, amount, reason]
  );
  return row.play_balance;
}
