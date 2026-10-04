"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "./CartContext";
import { createCheckoutUrl, isShopifyConfigured } from "../lib/shopify";

const FREE_SHIPPING_THRESHOLD = 75;

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
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const handleCheckout = async () => {
    setError(null);
    if (!isShopifyConfigured()) {
      setError("Checkout is not connected yet.");
      return;
    }
    setCheckingOut(true);
    try {
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
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={closeDrawer} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-night-900 border-l border-night-700 flex flex-col animate-drawer-in">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-night-700">
          <h2 className="font-display font-bold text-xl uppercase tracking-wide text-white">
            Your Cart {count > 0 && <span className="text-ember-400">({count})</span>}
          </h2>
          <button
            onClick={closeDrawer}
            aria-label="Close cart"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-night-700 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 grid place-items-center p-8 text-center">
            <div>
              <p className="text-slate-400 mb-4">Your cart is empty.</p>
              <button
                onClick={closeDrawer}
                className="rounded-xl bg-ember-500 hover:bg-ember-600 text-night-950 font-bold px-6 py-3 transition"
              >
                Keep Shopping
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* free shipping progress */}
            <div className="px-5 py-4 border-b border-night-700 bg-night-850">
              {remaining > 0 ? (
                <p className="text-sm text-slate-300 mb-2">
                  You&apos;re <strong className="text-ember-400">{money(remaining, currencyCode)}</strong> away
                  from <strong>free shipping</strong>
                </p>
              ) : (
                <p className="text-sm text-emerald-400 font-semibold mb-2">
                  You&apos;ve unlocked FREE shipping!
                </p>
              )}
              <div className="h-2 rounded-full bg-night-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ember-600 to-ember-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* lines */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 nice-scroll">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-3">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-white shrink-0 border border-night-700">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt={item.productTitle} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[10px] text-slate-500 bg-night-800">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.productHandle}`}
                      onClick={closeDrawer}
                      className="text-sm font-semibold text-slate-100 hover:text-ember-400 line-clamp-2"
                    >
                      {item.productTitle}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">{item.variantLabel}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center rounded-lg border border-night-600 overflow-hidden">
                        <button
                          className="px-2.5 py-1 text-slate-300 hover:bg-night-700"
                          onClick={() => setQuantity(item.variantId, item.quantity - 1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="px-2 text-sm font-bold text-white min-w-[2rem] text-center">
                          {item.quantity}
                        </span>
                        <button
                          className="px-2.5 py-1 text-slate-300 hover:bg-night-700"
                          onClick={() => setQuantity(item.variantId, item.quantity + 1)}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-bold text-ember-400">
                        {money(parseFloat(item.price.amount) * item.quantity, item.price.currencyCode)}
                      </span>
                    </div>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="text-xs text-slate-500 hover:text-red-400 mt-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* footer */}
            <div className="border-t border-night-700 px-5 py-4 bg-night-850">
              <div className="flex justify-between mb-1 text-sm text-slate-400">
                <span>Subtotal</span>
                <span className="font-display font-bold text-xl text-white">
                  {money(subtotal, currencyCode)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Shipping & taxes calculated at checkout.</p>
              {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="w-full rounded-xl bg-ember-500 hover:bg-ember-600 disabled:opacity-50 text-night-950 font-bold py-3.5 transition shadow-lg shadow-ember-600/20"
              >
                {checkingOut ? "Redirecting…" : "Secure Checkout"}
              </button>
              <Link
                href="/cart"
                onClick={closeDrawer}
                className="block text-center text-sm text-slate-400 hover:text-ember-400 mt-2.5"
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
