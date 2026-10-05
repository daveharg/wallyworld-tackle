import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    const normalized = email.trim().toLowerCase();
    await prisma.newsletterSubscriber.upsert({
      where: { email: normalized },
      update: {},
      create: { email: normalized },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("newsletter signup error", e);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
