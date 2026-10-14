// /api/fishmb/shops — public shop listings for the Maps overlays.
// GET ?kind=bait|tackle (omit kind for both).

import { NextRequest, NextResponse } from "next/server";
import { listShops, type ShopKind } from "@/lib/fish/shops";

export async function GET(req: NextRequest) {
  const kindParam = req.nextUrl.searchParams.get("kind");
  const kind: ShopKind | null =
    kindParam === "bait" || kindParam === "tackle" ? kindParam : null;
  const items = await listShops(kind);
  return NextResponse.json({ items });
}
