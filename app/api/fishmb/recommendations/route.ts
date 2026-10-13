// POST /api/fishmb/recommendations — the "give a recommendation"
// boxes. Signed in or anonymous; lands in the admin Recommendations
// tab. Light abuse care: field caps + a per-IP hourly soft limit.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest } from "@/lib/fish/auth";
import {
  createRecommendation,
  RECOMMENDATION_KINDS,
} from "@/lib/fish/recommendations";

const recentByIp = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const hits = (recentByIp.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= 10) {
    return NextResponse.json({ error: "That's plenty for now — thanks!" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 3) {
    return NextResponse.json({ error: "Tell us the recommendation first." }, { status: 400 });
  }
  const kindRaw = typeof body.kind === "string" ? body.kind : "general";
  const kind = (RECOMMENDATION_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "general";
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
  const page = typeof body.page === "string" ? body.page.slice(0, 300) : null;

  let userId: string | null = null;
  let name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  let email = typeof body.email === "string" ? body.email.trim().slice(0, 160) : "";
  try {
    const me = await fishUserFromRequest(req);
    if (me) {
      userId = me.id;
      name = me.name;
      email = me.email ?? email;
    }
  } catch {
    // Anonymous submission is fine.
  }

  hits.push(now);
  recentByIp.set(ip, hits);
  await createRecommendation({
    userId,
    name,
    email: email || null,
    kind,
    subject,
    message: message.slice(0, 3000),
    page,
  });
  return NextResponse.json({ ok: true });
}
