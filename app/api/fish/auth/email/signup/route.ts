// POST /api/fish/auth/email/signup — create a FishMB account with email + password.
//
// Body: { email, password, name?, age_confirmed: true, terms_accepted: true }
// Creates the user with a bcrypt password hash, a 30-day session, and the
// standard 1000-chip signup bonus. Returns { token, user, is_new_user: true }.
//
// This exists so testers can sign in on preview/tunnel URLs where Google's
// OAuth origin check blocks Google sign-in.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { withTransaction, txQueryOne } from "@/lib/fish/db";
import {
  createSession,
  pruneExpiredSessions,
  ensureProfileColumns,
  toApiUser,
  type FishUser,
} from "@/lib/fish/auth";
import { query } from "@/lib/fish/db";

async function ensurePasswordColumn() {
  await query(`ALTER TABLE fm_users ADD COLUMN IF NOT EXISTS password_hash text`);
}

/** Pick a unique display name, appending " 2", " 3", … when taken. */
async function uniqueDisplayName(base: string, client: unknown): Promise<string> {
  const clean = base.trim().slice(0, 80) || "Angler";
  const check = async (n: string) => {
    const rows = await txQueryOne<{ id: string }>(
      client as never,
      `SELECT id FROM fm_users WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [n]
    );
    return !rows;
  };
  if (await check(clean)) return clean;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${clean} ${i}`.slice(0, 80);
    if (await check(candidate)) return candidate;
  }
  return `${clean} ${Date.now().toString(36)}`.slice(0, 80);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const nameInput = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (body.age_confirmed !== true || body.terms_accepted !== true) {
    return NextResponse.json(
      { error: "You must confirm you are 13 or older and accept the Terms to join FishMB." },
      { status: 400 }
    );
  }

  await ensureProfileColumns();
  await ensurePasswordColumn();

  const sub = `email:${email}`;
  const hash = await bcrypt.hash(password, 12);

  let user: FishUser;
  try {
    user = await withTransaction(async (client) => {
      const clash = await txQueryOne<{ id: string }>(
        client,
        `SELECT id FROM fm_users WHERE google_sub = $1 OR LOWER(email) = LOWER($2) LIMIT 1`,
        [sub, email]
      );
      if (clash) throw new Error("EMAIL_TAKEN");
      const freshName = await uniqueDisplayName(
        nameInput || email.split("@")[0].replace(/[._-]+/g, " "),
        client
      );
      const created = await txQueryOne<FishUser>(
        client,
        `INSERT INTO fm_users (google_sub, name, email, password_hash, age_confirmed, terms_accepted)
         VALUES ($1, $2, $3, $4, true, true) RETURNING *`,
        [sub, freshName, email, hash]
      );
      await txQueryOne(
        client,
        `INSERT INTO fm_ledger (user_id, contest_id, amount, reason)
         VALUES ($1, NULL, 1000, 'signup_bonus')`,
        [created!.id]
      );
      return created!;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return NextResponse.json(
        { error: "An account with this email already exists. Try logging in." },
        { status: 409 }
      );
    }
    throw err;
  }

  const token = await createSession(user.id);
  pruneExpiredSessions();
  return NextResponse.json({ token, user: toApiUser(user), is_new_user: true });
}
