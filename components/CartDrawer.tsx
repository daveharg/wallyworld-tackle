"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCart } from "./CartContext";
import { createCheckoutUrl, isShopifyConfigured } from "../lib/shopify";

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function CartDrawer() {
  const { items, count, subtotal, currencyCode, setQuantity, removeItem, clear, isDrawerOpen, closeDrawer } =
    useCart();
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const handleCheckout = async () => {
    setError(null);
    if (!isShopifyConfigured()) {
      setError("Checkout is not connected yet.");
      return;
    }
    setCheckingOut(true);
    try {
      // Record a pending order for signed-in users so points can be claimed later.
      if (session?.user) {
        try {
          await fetch("/api/orders/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              total: subtotal,
              currency: currencyCode,
              email: session.user.email,
            }),
          });
        } catch {
          // non-fatal — checkout must still work
        }
      }
      const url = await createCheckoutUrl(
        items.map((i) => ({ merchandiseId: i.variantId, quantity: i.quantity }))
      );
      clear();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed. Please try again.");
      setCheckingOut(false);
    }
  };

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="absolute inset-0 bg-pine-deep/50 animate-fade-in" onClick={closeDrawer} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-paper border-l border-pine/10 flex flex-col animate-drawer-in">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-pine/10">
          <h2 className="font-display font-bold text-xl uppercase tracking-wide text-pine">
            Your Cart {count > 0 && <span className="text-signal">({count})</span>}
          </h2>
          <button
            onClick={closeDrawer}
            aria-label="Close cart"
            className="p-2 rounded-lg text-pine/60 hover:text-pine hover:bg-paper-deep transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 grid place-items-center p-8 text-center">
            <div>
              <p className="text-pine/60 mb-4">Your cart is empty.</p>
              <button
                onClick={closeDrawer}
                className="rounded-xl bg-signal hover:bg-signal-dark text-white font-bold px-6 py-3 transition"
              >
                Keep Shopping
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* free shipping — always qualifies */}
            <div className="px-5 py-4 border-b border-pine/10 bg-paper-deep">
              <p className="text-sm text-emerald-700 font-semibold mb-2">
                You qualify for FREE shipping!
              </p>
              <div className="h-2 rounded-full bg-pine/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* lines */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 nice-scroll">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-3">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-white shrink-0 border border-pine/10">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.productTitle} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[10px] text-pine/40 bg-paper-deep">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.productHandle}`}
                      onClick={closeDrawer}
                      className="text-sm font-semibold text-pine hover:text-signal line-clamp-2"
                    >
                      {item.productTitle}
                    </Link>
                    <p className="text-xs text-pine/50 mt-0.5">{item.variantLabel}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center rounded-lg border border-pine/15 overflow-hidden">
                        <button
                          className="px-2.5 py-1 text-pine/60 hover:bg-paper-deep"
                          onClick={() => setQuantity(item.variantId, item.quantity - 1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="px-2 text-sm font-bold text-pine min-w-[2rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          className="px-2.5 py-1 text-pine/60 hover:bg-paper-deep"
                          onClick={() => setQuantity(item.variantId, item.quantity + 1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-bold text-signal">
                        {money(parseFloat(item.price.amount) * item.quantity, item.price.currencyCode)}
                      </span>
                    </div>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="text-xs text-pine/45 hover:text-red-600 mt-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* footer */}
            <div className="border-t border-pine/10 px-5 py-4 bg-paper-deep">
              <div className="flex justify-between mb-1 text-sm text-pine/60">
                <span>Subtotal</span>
                <span className="font-display font-bold text-xl text-pine">
                  {money(subtotal, currencyCode)}
                </span>
              </div>
              <p className="text-xs text-pine/45 mb-3">Shipping & taxes calculated at checkout.</p>
              {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="w-full rounded-xl bg-signal hover:bg-signal-dark disabled:opacity-50 text-white font-bold py-3.5 transition shadow-md"
              >
                {checkingOut ? "Redirecting…" : "Secure Checkout"}
              </button>
              <Link
                href="/cart"
                onClick={closeDrawer}
                className="block text-center text-sm text-pine/55 hover:text-signal mt-2.5"
              >
                View full cart
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
