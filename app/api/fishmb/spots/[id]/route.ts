// /api/fishmb/spots/[id] — rename/notes (PATCH) or delete (DELETE) one of the
// signed-in user's own fishing spots. Owner-scoped: no one else's spots.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";
import { ensureSpotsTable, updateSpot, deleteSpot, isSpotIconId } from "@/lib/fish/spots";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureSpotsTable();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const patch: { name?: string; notes?: string | null; icon?: string; lakeId?: string | null } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string") return badRequest("name must be a string.");
    patch.name = body.name.trim().slice(0, 80);
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== "string" && body.notes !== null)
      return badRequest("notes must be a string or null.");
    patch.notes = body.notes;
  }
  if (body.icon !== undefined) {
    if (!isSpotIconId(body.icon)) return badRequest("Invalid spot icon.");
    patch.icon = body.icon;
  }
  if (body.lake_id !== undefined) {
    if (typeof body.lake_id !== "string" && body.lake_id !== null)
      return badRequest("lake_id must be a string or null.");
    patch.lakeId = body.lake_id;
  }
  const spot = await updateSpot(me.id, params.id, patch);
  if (!spot) return notFound();
  return NextResponse.json({ spot });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureSpotsTable();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const ok = await deleteSpot(me.id, params.id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
