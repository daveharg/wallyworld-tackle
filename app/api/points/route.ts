import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireUser } from "../../../lib/session-user";
import { POINTS_PER_DOLLAR, REDEEM_POINTS, REDEEM_VALUE } from "../../../lib/loyalty";

async function getSummary(userId: string) {
  const loyalty = await prisma.loyaltyPoints.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  const transactions = await prisma.pointsTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const credits = await prisma.storeCredit.findMany({
    where: { userId, redeemed: false },
    orderBy: { createdAt: "desc" },
  });
  return {
    balance: loyalty.pointsBalance,
    lifetime: loyalty.lifetimePoints,
    transactions: transactions.map((t) => ({
      id: t.id,
      points: t.points,
      type: t.type,
      orderId: t.orderId,
      note: t.note,
      createdAt: t.createdAt,
    })),
    credits: credits.map((c) => ({
      code: c.code,
      amount: c.amount,
      currency: c.currency,
      createdAt: c.createdAt,
    })),
    earnRate: POINTS_PER_DOLLAR,
    redeemPoints: REDEEM_POINTS,
    redeemValue: REDEEM_VALUE,
  };
}

// GET /api/points — current balance, lifetime, recent transactions, unused credits.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json(await getSummary(user.id));
}

// POST /api/points — credit points. Body: { points, type?, orderId?, note? }
// Protected: the caller must either be the signed-in user crediting THEMSELVES
// (type must be "earn" and is capped), or present POINTS_ADMIN_SECRET for
// manual/webhook adjustments of any user.
export async function POST(req: Request) {
  const adminSecret = process.env.POINTS_ADMIN_SECRET;
  const { userId, email, points, type = "earn", orderId, note, adminKey } = await req.json().catch(
    () => ({})
  );

  const n = Math.floor(Number(points));
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 100000) {
    return NextResponse.json({ error: "Invalid points value." }, { status: 400 });
  }

  const isAdmin = Boolean(adminSecret) && adminKey === adminSecret;
  let targetId: string | null = null;

  if (isAdmin) {
    if (userId) {
      targetId = String(userId);
    } else if (email) {
      const u = await prisma.user.findUnique({
        where: { email: String(email).toLowerCase() },
      });
      if (!u) return NextResponse.json({ error: "User not found." }, { status: 404 });
      targetId = u.id;
    } else {
      return NextResponse.json({ error: "userId or email required." }, { status: 400 });
    }
  } else {
    // Self-service: signed-in users may only earn (capped per call) for themselves,
    // e.g. claiming points for a completed order. Redemptions go through /api/points/redeem.
    if (type !== "earn" || n < 0 || n > 5000) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    targetId = user.id;
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  await prisma.$transaction([
    prisma.loyaltyPoints.upsert({
      where: { userId: target.id },
      update: {
        pointsBalance: { increment: n },
        lifetimePoints: n > 0 ? { increment: n } : undefined,
      },
      create: { userId: target.id, pointsBalance: Math.max(0, n), lifetimePoints: Math.max(0, n) },
    }),
    prisma.pointsTransaction.create({
      data: { userId: target.id, points: n, type, orderId: orderId ?? null, note: note ?? null },
    }),
  ]);

  return NextResponse.json({ ok: true, ...(await getSummary(target.id)) });
}
