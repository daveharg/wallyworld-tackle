// /api/fishmb/traditional-suggestions — user-submitted traditional tournament ideas.
// GET  — admin only (list all, optional ?status=). The public list lives in
//         public/fishmb/tournaments.json, curated by the weekly research cron.
// POST — auth required; creates a 'pending' suggestion for admin review.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  forbidden,
} from "@/lib/fish/auth";
import {
  ensureTraditionalTables,
  listSuggestions,
} from "@/lib/fish/traditional";
import { isAdminEmail } from "@/lib/fish/business";
import { query } from "@/lib/fish/db";

const LIMITS = {
  name: 120,
  dates: 120,
  location: 160,
  entry: 120,
  description: 1000,
  url: 500,
};

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  if (!isAdminEmail(me.email)) return forbidden("Admin only.");
  await ensureTraditionalTables();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  if (status && !["pending", "approved", "rejected", "merged"].includes(status))
    return badRequest("Invalid status filter.");
  return NextResponse.json({ suggestions: await listSuggestions(status) });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureTraditionalTables();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const str = (k: string, max: number, required: boolean) => {
    const v = typeof body[k] === "string" ? body[k].trim() : "";
    if (required && !v) throw new Error(`${k} is required.`);
    return v.slice(0, max);
  };

  let name = "",
    dates = "",
    location = "",
    entry = "",
    description = "",
    url = "";
  try {
    name = str("name", LIMITS.name, true);
    dates = str("dates", LIMITS.dates, false);
    location = str("location", LIMITS.location, false);
    entry = str("entry", LIMITS.entry, false);
    description = str("description", LIMITS.description, false);
    url = str("url", LIMITS.url, false);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Invalid fields.");
  }

  if (url && !/^https?:\/\//.test(url))
    return badRequest("Official URL must start with http(s)://.");

  const rows = await query(
    `INSERT INTO fm_traditional_suggestions (user_id, name, dates, location, entry, description, url, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
    [me.id, name, dates, location, entry, description, url]
  );
  return NextResponse.json({ suggestion: rows[0] }, { status: 201 });
}
