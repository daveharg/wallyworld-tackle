// POST /api/fish/auth/google — exchange a Google ID token for a Fish session.
//
// Body: { id_token: string }  (from Google Sign-In on the mobile app)
// Verifies the token signature/audience/expiry, upserts fm_users, creates a
// 30-day session. New users start with 1000 play-money chips + a signup_bonus
// ledger row. The id_token is never logged.
//
// OPTIONAL LINK FLOW: if the request carries `Authorization: Bearer <token>`
// and that session belongs to an ANONYMOUS user (google_sub starts with
// 'anon:'), the Google account is LINKED to the guest account instead of
// creating a new user: google_sub is replaced with the real Google sub,
// email/avatar are filled in from the Google profile, and name is updated only
// if it is still 'Guest Angler'. All history — catches, friends, contests,
// play_balance and ledger rows — carries over. The existing session token is
// KEPT (no rotation) and returned unchanged, with `linked: true`.
// A malformed Bearer header is a 401; linking to a Google account that already
// belongs to a different FishMB user is a 409.
// Without a Bearer token, the classic upsert-by-google_sub behavior applies.

import { NextRequest, NextResponse } from "next/server";
import { queryOne, withTransaction, txQueryOne } from "@/lib/fish/db";
import {
  createSession,
  pruneExpiredSessions,
  getBearerToken,
  fishUserFromRequest,
  isAnonymousUser,
  toApiUser,
  type FishUser,
} from "@/lib/fish/auth";
import { verifyGoogleIdToken } from "@/lib/fish/google";

export async function POST(req: NextRequest) {
  let body: { id_token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const idToken = body?.id_token;
  if (typeof idToken !== "string" || idToken.length === 0 || idToken.length > 8192) {
    return NextResponse.json({ error: "id_token is required." }, { status: 400 });
  }

  let profile;
  try {
    profile = await verifyGoogleIdToken(idToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign-in failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  // Optional link flow: Bearer token present → must be a valid session.
  const rawAuth = req.headers.get("authorization");
  const bearer = getBearerToken(req);
  if (rawAuth !== null && bearer === null) {
    return NextResponse.json({ error: "Invalid session token." }, { status: 401 });
  }
  if (bearer !== null) {
    const current = await fishUserFromRequest(req);
    if (!current) {
      return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
    }
    if (isAnonymousUser(current)) {
      let linked: FishUser | null;
      try {
        linked = await withTransaction(async (client) => {
          const clash = await txQueryOne<{ id: string }>(
            client,
            `SELECT id FROM fm_users WHERE google_sub = $1 AND id <> $2`,
            [profile.sub, current.id]
          );
          if (clash) throw new Error("LINK_CONFLICT");
          const updated = await txQueryOne<FishUser>(
            client,
            `UPDATE fm_users
                SET google_sub = $2,
                    name = CASE WHEN name = 'Guest Angler' THEN $3 ELSE name END,
                    email = COALESCE($4, email),
                    avatar_url = COALESCE($5, avatar_url)
              WHERE id = $1 RETURNING *`,
            [current.id, profile.sub, profile.name, profile.email, profile.picture]
          );
          return updated!;
        });
      } catch (err) {
        if (err instanceof Error && err.message === "LINK_CONFLICT") {
          return NextResponse.json(
            { error: "This Google account is already linked to another FishMB user." },
            { status: 409 }
          );
        }
        throw err;
      }
      // Keep the existing session token (no rotation); the client already holds it.
      return NextResponse.json({ token: bearer, user: toApiUser(linked!), linked: true });
    }
    // Non-anonymous Bearer: fall through to the classic upsert below.
  }

  const { user, isNew } = await withTransaction(async (client) => {
    const existing = await txQueryOne<FishUser>(
      client,
      `SELECT * FROM fm_users WHERE google_sub = $1`,
      [profile.sub]
    );
    if (existing) {
      // Refresh profile details on each sign-in.
      const updated = await txQueryOne<FishUser>(
        client,
        `UPDATE fm_users
            SET name = $2, email = COALESCE($3, email), avatar_url = COALESCE($4, avatar_url)
          WHERE id = $1 RETURNING *`,
        [existing.id, profile.name, profile.email, profile.picture]
      );
      return { user: updated!, isNew: false };
    }
    const created = await txQueryOne<FishUser>(
      client,
      `INSERT INTO fm_users (google_sub, name, email, avatar_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [profile.sub, profile.name, profile.email, profile.picture]
    );
    // Signup bonus: 1000 starting chips (balance default) + audit row.
    await txQueryOne(
      client,
      `INSERT INTO fm_ledger (user_id, contest_id, amount, reason)
       VALUES ($1, NULL, 1000, 'signup_bonus')`,
      [created!.id]
    );
    return { user: created!, isNew: true };
  });

  const token = await createSession(user.id);
  pruneExpiredSessions();

  return NextResponse.json({ token, user: toApiUser(user), is_new_user: isNew });
}
