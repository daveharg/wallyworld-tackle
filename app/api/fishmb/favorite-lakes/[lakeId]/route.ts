// /api/fishmb/favorite-lakes/[lakeId] — remove a favorite lake.
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { removeFavoriteLake } from "@/lib/fish/spots";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ lakeId: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { lakeId } = await params;
  await removeFavoriteLake(me.id, lakeId);
  return NextResponse.json({ ok: true });
}
