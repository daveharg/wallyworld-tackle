import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireUser } from "../../../lib/session-user";

// GET /api/cart — fetch the saved server-side cart for the signed-in user.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const saved = await prisma.savedCart.findUnique({ where: { userId: user.id } });
  let items: unknown[] = [];
  if (saved?.cartData) {
    try {
      const parsed = JSON.parse(saved.cartData);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      items = [];
    }
  }
  return NextResponse.json({ items, updatedAt: saved?.updatedAt ?? null });
}

// PUT /api/cart — save the cart. Body: { items: CartItem[] }
export async function PUT(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { items } = await req.json().catch(() => ({}));
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "items must be an array." }, { status: 400 });
  }
  // Keep the payload small — strip anything but the fields the cart needs.
  const clean = items
    .filter((i) => i && typeof i.variantId === "string")
    .map((i) => ({
      variantId: String(i.variantId),
      productHandle: String(i.productHandle ?? ""),
      productTitle: String(i.productTitle ?? ""),
      variantLabel: String(i.variantLabel ?? ""),
      imageUrl: typeof i.imageUrl === "string" ? i.imageUrl : null,
      price: {
        amount: String(i.price?.amount ?? "0"),
        currencyCode: String(i.price?.currencyCode ?? "CAD"),
      },
      quantity: Math.max(1, Math.min(99, Math.floor(Number(i.quantity) || 1))),
    }))
    .slice(0, 100);

  await prisma.savedCart.upsert({
    where: { userId: user.id },
    update: { cartData: JSON.stringify(clean) },
    create: { userId: user.id, cartData: JSON.stringify(clean) },
  });
  return NextResponse.json({ ok: true, count: clean.length });
}
