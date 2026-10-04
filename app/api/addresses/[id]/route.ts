import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireUser } from "../../../../lib/session-user";

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

async function owned(userId: string, id: string) {
  return prisma.address.findFirst({ where: { id, userId } });
}

// PUT /api/addresses/[id] — update an address.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const existing = await owned(user.id, params.id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data = cleanAddress(body);
  if (body.isDefault === true) {
    await prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }
  const address = await prisma.address.update({
    where: { id: params.id },
    data: { ...data, isDefault: body.isDefault === true ? true : existing.isDefault },
  });
  return NextResponse.json({ address });
}

// DELETE /api/addresses/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const existing = await owned(user.id, params.id);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await prisma.address.delete({ where: { id: params.id } });
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId: user.id },
      orderBy: { label: "asc" },
    });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return NextResponse.json({ ok: true });
}
