import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/session-user";

// POST /api/orders/record — called when a signed-in user starts Shopify checkout.
// Records a "pending" order so we know what to credit points for later.
// Body: { total, currency?, email? }
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { total, currency, email } = await req.json().catch(() => ({}));
  const t = Number(total);
  if (!Number.isFinite(t) || t <= 0) {
    return NextResponse.json({ error: "Invalid total." }, { status: 400 });
  }
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      total: Math.round(t * 100) / 100,
      currency: typeof currency === "string" ? currency.slice(0, 8) : "CAD",
      email: typeof email === "string" ? email.slice(0, 160) : user.email,
      status: "pending",
    },
  });
  return NextResponse.json({ ok: true, orderId: order.id }, { status: 201 });
}
