import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/session-user";
import { REDEEM_POINTS, REDEEM_VALUE } from "../../../../lib/loyalty";

function makeCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `WALLY-${s}`;
}

// POST /api/points/redeem — signed-in user converts 100 pts → $5 store credit.
export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const loyalty = await prisma.loyaltyPoints.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  if (loyalty.pointsBalance < REDEEM_POINTS) {
    return NextResponse.json(
      { error: `You need ${REDEEM_POINTS} points to redeem. You have ${loyalty.pointsBalance}.` },
      { status: 400 }
    );
  }

  const code = makeCode();
  await prisma.$transaction([
    prisma.loyaltyPoints.update({
      where: { userId: user.id },
      data: { pointsBalance: { decrement: REDEEM_POINTS } },
    }),
    prisma.pointsTransaction.create({
      data: {
        userId: user.id,
        points: -REDEEM_POINTS,
        type: "redeem",
        note: `Redeemed for ${code} ($${REDEEM_VALUE} store credit)`,
      },
    }),
    prisma.storeCredit.create({
      data: { userId: user.id, code, amount: REDEEM_VALUE, currency: "CAD" },
    }),
  ]);

  const summary = await prisma.loyaltyPoints.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    ok: true,
    code,
    amount: REDEEM_VALUE,
    balance: summary?.pointsBalance ?? 0,
  });
}
