import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireUser } from "../../../lib/session-user";

// GET /api/orders — the signed-in user's recorded orders (newest first).
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: o.total,
      currency: o.currency,
      status: o.status,
      pointsCredited: o.pointsCredited,
      createdAt: o.createdAt,
    })),
  });
}
