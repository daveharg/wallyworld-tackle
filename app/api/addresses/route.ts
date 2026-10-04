import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireUser } from "../../../lib/session-user";

function cleanAddress(body: Record<string, unknown>) {
  const s = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);
  return {
    label: s(body.label, 40) || "Home",
    name: s(body.name),
    address1: s(body.address1),
    address2: s(body.address2) || null,
    city: s(body.city),
    province: s(body.province),
    postalCode: s(body.postalCode, 20).toUpperCase(),
    country: s(body.country, 60) || "Canada",
    phone: s(body.phone, 30) || null,
  };
}

// GET /api/addresses — list the signed-in user's saved addresses.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });
  return NextResponse.json({ addresses });
}

// POST /api/addresses — add an address. { ..., isDefault? }
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data = cleanAddress(body);
  if (!data.name || !data.address1 || !data.city || !data.province || !data.postalCode) {
    return NextResponse.json(
      { error: "Name, street, city, province and postal code are required." },
      { status: 400 }
    );
  }
  const existingCount = await prisma.address.count({ where: { userId: user.id } });
  const isDefault = body.isDefault === true || existingCount === 0;
  if (isDefault) {
    await prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }
  const address = await prisma.address.create({
    data: { ...data, userId: user.id, isDefault },
  });
  return NextResponse.json({ address }, { status: 201 });
}
