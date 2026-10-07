// POST /api/fishmb/lake-requests — request a missing lake (public).
// Stores into fm_lake_requests (created idempotently on first use).

import { NextRequest, NextResponse } from "next/server";
import { badRequest } from "@/lib/fish/auth";
import { query } from "@/lib/fish/db";

let ensured = false;

async function ensureTable(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_lake_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lake_name text NOT NULL,
    location_hint text NOT NULL DEFAULT '',
    contact text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
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
  const lakeName = typeof body.lake_name === "string" ? body.lake_name.trim().slice(0, 120) : "";
  if (lakeName.length < 3) return badRequest("Tell us the lake's name.");
  const hint = typeof body.location_hint === "string" ? body.location_hint.trim().slice(0, 500) : "";
  const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 120) : "";
  await query(
    `INSERT INTO fm_lake_requests (lake_name, location_hint, contact) VALUES ($1, $2, $3)`,
    [lakeName, hint, contact]
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
