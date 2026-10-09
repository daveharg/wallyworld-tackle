// POST /api/fishmb/classifieds/[id]/sold — mark your own listing sold (auth, owner).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, notFound } from "@/lib/fish/auth";
import { markSold } from "@/lib/fish/classifieds";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const ok = await markSold(id, me.id).catch(() => false);
  if (!ok) return notFound("Listing not found.");
  return NextResponse.json({ ok: true });
}
