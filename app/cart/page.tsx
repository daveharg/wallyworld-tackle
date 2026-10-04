"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "../../components/CartContext";
import { createCheckoutUrl, isShopifyConfigured } from "../../lib/shopify";
import Breadcrumbs from "../../components/Breadcrumbs";

const FREE_SHIPPING_THRESHOLD = 75;

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function CartPage() {
  const { items, count, subtotal, currencyCode, setQuantity, removeItem, clear } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const handleCheckout = async () => {
    setError(null);
    if (!isShopifyConfigured()) {
      setError("Checkout is not connected yet. Set your Shopify environment variables.");
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Breadcrumbs trail={[{ label: "Home", href: "/" }, { label: "Cart" }]} />
      <h1 className="font-display font-bold uppercase text-4xl text-white tracking-wide mt-3">
        Your Cart {count > 0 && <span className="text-ember-400">({count})</span>}
      </h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-20 h-20 rounded-full bg-night-800 border border-night-700 grid place-items-center mb-5">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.6" />
              <circle cx="17" cy="20" r="1.6" />
              <path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20.5 7H6" />
            </svg>
          </div>
          <p className="text-slate-400 text-lg">Your cart is empty.</p>
          <Link
            href="/"
            className="inline-block mt-5 rounded-xl bg-ember-500 hover:bg-ember-600 text-night-950 font-bold px-8 py-3.5 transition"
          >
            Keep Shopping
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 mt-8">
          {/* lines */}
          <div className="space-y-4">
            {/* free shipping progress */}
            <div className="rounded-2xl bg-night-900 border border-night-700 p-5">
              {remaining > 0 ? (
                <p className="text-sm text-slate-300 mb-2">
                  You&apos;re <strong className="text-ember-400">{money(remaining, currencyCode)}</strong>{" "}
                  away from <strong>free shipping</strong>
                </p>
              ) : (
                <p className="text-sm text-emerald-400 font-semibold mb-2">
                  You&apos;ve unlocked FREE shipping!
                </p>
              )}
              <div className="h-2.5 rounded-full bg-night-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ember-600 to-ember-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {items.map((item) => (
              <div
                key={item.variantId}
                className="flex gap-4 rounded-2xl bg-night-900 border border-night-700 p-4"
              >
                <Link
                  href={`/products/${item.productHandle}`}
                  className="w-24 h-24 rounded-xl overflow-hidden bg-white shrink-0 border border-night-700"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.productTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-[10px] text-slate-500 bg-night-800">
                      No image
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/products/${item.productHandle}`}
                    className="font-semibold text-slate-100 hover:text-ember-400 line-clamp-2"
                  >
                    {item.productTitle}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1">{item.variantLabel}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center rounded-lg border border-night-600 overflow-hidden">
                      <button
                        className="px-3 py-1.5 text-slate-300 hover:bg-night-700"
                        onClick={() => setQuantity(item.variantId, item.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="px-2 text-sm font-bold text-white min-w-[2rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        className="px-3 py-1.5 text-slate-300 hover:bg-night-700"
                        onClick={() => setQuantity(item.variantId, item.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-display font-bold text-lg text-ember-400">
                      {money(parseFloat(item.price.amount) * item.quantity, item.price.currencyCode)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeItem(item.variantId)}
                    className="text-xs text-slate-500 hover:text-red-400 mt-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* summary */}
          <div>
            <div className="rounded-2xl bg-night-900 border border-night-700 p-6 lg:sticky lg:top-24">
              <h2 className="font-display font-bold uppercase tracking-wide text-lg text-white mb-4">
                Order Summary
              </h2>
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Subtotal</span>
                <span className="text-white font-semibold">{money(subtotal, currencyCode)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400 mb-4">
                <span>Shipping</span>
                <span>{remaining > 0 ? "Calculated at checkout" : "FREE"}</span>
              </div>
              <div className="border-t border-night-700 pt-4 flex justify-between items-center mb-5">
                <span className="font-semibold text-white">Total</span>
                <span className="font-display font-bold text-2xl text-ember-400">
                  {money(subtotal, currencyCode)}
                </span>
              </div>
              {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="w-full rounded-xl bg-ember-500 hover:bg-ember-600 disabled:opacity-50 text-night-950 font-bold py-4 transition shadow-xl shadow-ember-600/20"
              >
                {checkingOut ? "Redirecting to checkout…" : "Secure Checkout"}
              </button>
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                Secure checkout powered by Shopify
              </div>
              <Link
                href="/"
                className="block text-center text-sm text-ember-400 hover:text-ember-500 font-semibold mt-4"
              >
                ← Continue shopping
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
