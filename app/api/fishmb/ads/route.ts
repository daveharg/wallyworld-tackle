// /api/fishmb/ads — paid advertisements.
// GET ?slot=feed|homepage_banner — active ads (public).
// POST — submit an ad (business accounts only; goes live after approval).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, forbidden } from "@/lib/fish/auth";
import { ensureBusinessTables, getActiveAds, getMyBusiness } from "@/lib/fish/business";
import { query } from "@/lib/fish/db";
import { AD_PRICES } from "@/lib/fish/business";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slot = searchParams.get("slot");
  if (slot !== "feed" && slot !== "homepage_banner") {
    return badRequest("slot must be 'feed' or 'homepage_banner'.");
  }
  const ads = await getActiveAds(slot);
  return NextResponse.json({ ads });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureBusinessTables();
  const accountType = (me as { account_type?: string }).account_type ?? "personal";
  if (accountType !== "business") {
    return forbidden("Only business accounts can advertise.");
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const slot = body.slot;
  if (slot !== "feed" && slot !== "homepage_banner") {
    return badRequest("slot must be 'feed' or 'homepage_banner'.");
  }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
  if (!title) return badRequest("Ad headline is required.");
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 300) : "";
  const imageUrl =
    typeof body.image_url === "string" && /^https?:\/\//.test(body.image_url.trim())
      ? body.image_url.trim()
      : null;
  const videoUrl =
    typeof body.video_url === "string" && /^https?:\/\//.test(body.video_url.trim())
      ? body.video_url.trim()
      : null;
  if (!imageUrl && !videoUrl) return badRequest("An image or video is required.");
  const linkUrl =
    typeof body.link_url === "string" && body.link_url.trim()
      ? body.link_url.trim().slice(0, 500)
      : null;
  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) return badRequest("Link must be a URL.");

  const biz = await getMyBusiness(me.id);
  const price = AD_PRICES[slot].price_cents;
  const rows = await query(
    `INSERT INTO fm_ads (user_id, business_id, slot, title, body, image_url, video_url, link_url, price_cents)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, slot, title, status, price_cents, created_at`,
    [me.id, biz?.id ?? null, slot, title, text, imageUrl, videoUrl, linkUrl, price]
  );
  return NextResponse.json({ ad: rows[0] }, { status: 201 });
}
