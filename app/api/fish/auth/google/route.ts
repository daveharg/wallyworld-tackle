// POST /api/fish/auth/google — exchange a Google ID token for a Fish session.
//
// Body: { id_token: string }  (from Google Sign-In on the mobile app)
// Verifies the token signature/audience/expiry, upserts fm_users, creates a
// 30-day session. New users start with 1000 play-money chips + a signup_bonus
// ledger row. The id_token is never logged.

import { NextRequest, NextResponse } from "next/server";
import { queryOne, withTransaction, txQueryOne } from "@/lib/fish/db";
import { createSession, pruneExpiredSessions, type FishUser } from "@/lib/fish/auth";
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

  const user = await withTransaction(async (client) => {
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
      return updated!;
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
    return created!;
  });

  const token = await createSession(user.id);
  pruneExpiredSessions();

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      stats_public: user.stats_public,
      play_balance: user.play_balance,
    },
  });
}
