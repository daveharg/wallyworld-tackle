// GET /api/fishmb/classifieds/[id] — one listing (public).

import { NextRequest, NextResponse } from "next/server";
import { notFound } from "@/lib/fish/auth";
import { getClassified } from "@/lib/fish/classifieds";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getClassified(id).catch(() => null);
  if (!item) return notFound("Listing not found.");
  return NextResponse.json({ item });
}
