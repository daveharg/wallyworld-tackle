import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/session-user";
import { POINTS_PER_DOLLAR } from "../../../../lib/loyalty";

// POST /api/orders/claim — the signed-in user confirms their latest pending
// order was completed and claims loyalty points (1 pt per $1 spent).
// Idempotent: each order is credited at most once.
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { orderId } = await req.json().catch(() => ({}));

  const where: { userId: string; status: string; id?: string } = {
    userId: user.id,
    status: "pending",
  };
  if (typeof orderId === "string" && orderId) where.id = orderId;

  const order = await prisma.order.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });
  if (!order) {
    return NextResponse.json({ error: "No pending order to claim." }, { status: 404 });
  }

  const points = Math.floor(order.total * POINTS_PER_DOLLAR);
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "completed", pointsCredited: true },
    }),
    ...(points > 0
      ? [
          prisma.loyaltyPoints.upsert({
            where: { userId: user.id },
            update: {
              pointsBalance: { increment: points },
              lifetimePoints: { increment: points },
            },
            create: { userId: user.id, pointsBalance: points, lifetimePoints: points },
          }),
          prisma.pointsTransaction.create({
            data: {
              userId: user.id,
              points,
              type: "earn",
              orderId: order.id,
              note: `Earned on order ${order.orderNumber ?? order.id.slice(0, 8)} ($${order.total.toFixed(2)})`,
            },
          }),
        ]
      : []),
  ]);

  const loyalty = await prisma.loyaltyPoints.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    ok: true,
    pointsEarned: points,
    balance: loyalty?.pointsBalance ?? 0,
  });
}
