// POST /api/fishmb/classifieds/[id]/delete — delete your own listing (auth, owner).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, notFound } from "@/lib/fish/auth";
import { deleteClassified } from "@/lib/fish/classifieds";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const ok = await deleteClassified(id, me.id).catch(() => false);
  if (!ok) return notFound("Listing not found.");
  return NextResponse.json({ ok: true });
}
