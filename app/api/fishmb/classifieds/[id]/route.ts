// DELETE /api/fishmb/classifieds/[id] — remove your own listing (auth).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, notFound } from "@/lib/fish/auth";
import { deleteClassified } from "@/lib/fish/classifieds";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const ok = await deleteClassified(params.id, me.id);
  if (!ok) return notFound("Listing not found.");
  return NextResponse.json({ ok: true });
}
