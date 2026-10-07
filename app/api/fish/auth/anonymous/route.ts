// POST /api/fish/auth/anonymous — create an instant guest account, no login.
//
// No auth, no body. Creates an fm_users row with google_sub = 'anon:' + random
// hex, name 'Guest Angler', 1000 starting chips + a signup_bonus ledger row in
// the same transaction (matching the Google signup flow), and a 30-day session.
// Returns { token, user } in the same shape as POST /api/fish/auth/google.
//
// The guest can later link a Google account by calling
// POST /api/fish/auth/google with this session's Bearer token — catches,
// friends, contests, play_balance and ledger history all carry over.

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { withTransaction, txQueryOne } from "@/lib/fish/db";
import {
  createSession,
  pruneExpiredSessions,
  toApiUser,
  type FishUser,
} from "@/lib/fish/auth";

export async function POST() {
  const googleSub = "anon:" + randomBytes(16).toString("hex");
  const user = await withTransaction(async (client) => {
    const created = await txQueryOne<FishUser>(
      client,
      `INSERT INTO fm_users (google_sub, name)
       VALUES ($1, 'Guest Angler') RETURNING *`,
      [googleSub]
    );
    // Signup bonus: 1000 starting chips (balance default) + audit row,
    // mirroring the Google signup flow.
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

  return NextResponse.json({ token, user: toApiUser(user) }, { status: 201 });
}
