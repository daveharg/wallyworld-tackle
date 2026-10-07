// POST /api/fishmb/lodge-requests — request a missing lodge/guide, or (logged in)
// submit your own guiding business for the directory (Dave reviews before it goes live).
// Stores into fm_lodge_requests (created idempotently on first use).

import { NextRequest, NextResponse } from "next/server";
import { badRequest, fishUserFromRequest } from "@/lib/fish/auth";
import { query } from "@/lib/fish/db";

let ensured = false;

async function ensureTable(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_lodge_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name text NOT NULL,
    kind text NOT NULL DEFAULT 'lodge',
    location text NOT NULL DEFAULT '',
    waters text NOT NULL DEFAULT '',
    contact text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    self_listed boolean NOT NULL DEFAULT false,
    user_id uuid REFERENCES fm_users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(`ALTER TABLE fm_lodge_requests ADD COLUMN IF NOT EXISTS self_listed boolean NOT NULL DEFAULT false`);
  await query(`ALTER TABLE fm_lodge_requests ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES fm_users(id) ON DELETE SET NULL`);
  ensured = true;
}

export async function POST(req: NextRequest) {
  await ensureTable();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const businessName = typeof body.business_name === "string" ? body.business_name.trim().slice(0, 120) : "";
  if (businessName.length < 3) return badRequest("Tell us the business name.");
  const kind = body.kind === "guide" ? "guide" : "lodge";
  const location = typeof body.location === "string" ? body.location.trim().slice(0, 200) : "";
  const waters = typeof body.waters === "string" ? body.waters.trim().slice(0, 500) : "";
  const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 200) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";

  const selfListed = body.self_listed === true;
  let userId: string | null = null;
  if (selfListed) {
    const me = await fishUserFromRequest(req);
    if (!me) return NextResponse.json({ error: "Log in to list your business." }, { status: 401 });
    userId = me.id;
    if (!contact) return badRequest("Add a way for anglers to reach you (phone, email or website).");
  }

  await query(
    `INSERT INTO fm_lodge_requests (business_name, kind, location, waters, contact, description, self_listed, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [businessName, kind, location, waters, contact, description, selfListed, userId]
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
