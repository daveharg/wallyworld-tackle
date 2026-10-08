// /api/fishmb/trails/[id] — delete one of the signed-in user's trails.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  notFound,
} from "@/lib/fish/auth";
import { deleteTrail } from "@/lib/fish/trails";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const ok = await deleteTrail(me.id, params.id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
