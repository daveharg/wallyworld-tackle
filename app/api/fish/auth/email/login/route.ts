// POST /api/fish/auth/email/login — sign in with email + password.
//
// Body: { email, password }
// Verifies the bcrypt hash, creates a 30-day session.
// Returns { token, user }.

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/fish/db";
import {
  createSession,
  pruneExpiredSessions,
  toApiUser,
  type FishUser,
} from "@/lib/fish/auth";

async function ensurePasswordColumn() {
  await query(`ALTER TABLE fm_users ADD COLUMN IF NOT EXISTS password_hash text`);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  await ensurePasswordColumn();

  const user = await queryOne<FishUser & { password_hash: string | null }>(
    `SELECT * FROM fm_users WHERE LOWER(email) = LOWER($1) AND password_hash IS NOT NULL LIMIT 1`,
    [email]
  );
  // Generic message — never reveal whether the email exists.
  const invalid = NextResponse.json(
    { error: "Email or password is incorrect." },
    { status: 401 }
  );
  if (!user?.password_hash) return invalid;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return invalid;
  if (user.suspended) {
    return NextResponse.json(
      { error: "Your account has been suspended. Contact FishMB support." },
      { status: 403 }
    );
  }

  const token = await createSession(user.id);
  pruneExpiredSessions();
  return NextResponse.json({ token, user: toApiUser(user) });
}
