// /api/fishmb/lake-notes — the signed-in angler's personal lake notes.
// GET: list mine. POST: { lake_id, notes } upsert. Lake names/coords are
// resolved client-side from the lake directory.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
} from "@/lib/fish/auth";
import { listLakeNotes, saveLakeNote } from "@/lib/fish/lake-notes";
import { getLake } from "@/lib/fishmb";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const notes = await listLakeNotes(me.id);
  return NextResponse.json({
    notes: notes.map((n) => {
      const lake = getLake(n.lake_id);
      return { ...n, lake_name: lake?.name ?? n.lake_id };
    }),
  });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const lakeId = typeof body.lake_id === "string" ? body.lake_id.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 5000) : "";
  if (!lakeId) return badRequest("lake_id is required.");
  if (!getLake(lakeId)) return badRequest("Unknown lake.");
  if (!notes) return badRequest("Notes are empty.");
  const note = await saveLakeNote(me.id, lakeId, notes);
  const lake = getLake(lakeId);
  return NextResponse.json({ note: { ...note, lake_name: lake?.name ?? lakeId } });
}
