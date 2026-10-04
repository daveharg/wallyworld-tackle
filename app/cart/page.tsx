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
      <h1 className="font-display font-bold uppercase text-4xl text-pine tracking-wide mt-3">
        Your Cart {count > 0 && <span className="text-signal">({count})</span>}
      </h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-20 h-20 rounded-full bg-paper-deep border border-pine/10 grid place-items-center mb-5">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#12322b" opacity="0.4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.6" />
              <circle cx="17" cy="20" r="1.6" />
              <path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20.5 7H6" />
            </svg>
          </div>
          <p className="text-pine/60 text-lg">Your cart is empty.</p>
          <Link
            href="/"
            className="inline-block mt-5 rounded-xl bg-signal hover:bg-signal-dark text-white font-bold px-8 py-3.5 transition"
          >
            Keep Shopping
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 mt-8">
          {/* lines */}
          <div className="space-y-4">
            {/* free shipping progress */}
            <div className="rounded-2xl bg-white border border-pine/10 p-5">
              {remaining > 0 ? (
                <p className="text-sm text-pine/70 mb-2">
                  You&apos;re <strong className="text-signal">{money(remaining, currencyCode)}</strong>{" "}
                  away from <strong>free shipping</strong>
                </p>
              ) : (
                <p className="text-sm text-emerald-700 font-semibold mb-2">
                  You&apos;ve unlocked FREE shipping!
                </p>
              )}
              <div className="h-2.5 rounded-full bg-pine/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-signal transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {items.map((item) => (
              <div
                key={item.variantId}
                className="flex gap-4 rounded-2xl bg-white border border-pine/10 p-4"
              >
                <Link
                  href={`/products/${item.productHandle}`}
                  className="w-24 h-24 rounded-xl overflow-hidden bg-paper-deep shrink-0 border border-pine/10"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.productTitle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-[10px] text-pine/40 bg-paper-deep">
                      No image
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/products/${item.productHandle}`}
                    className="font-semibold text-pine hover:text-signal line-clamp-2"
                  >
                    {item.productTitle}
                  </Link>
                  <p className="text-xs text-pine/50 mt-1">{item.variantLabel}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center rounded-lg border border-pine/15 overflow-hidden">
                      <button
                        className="px-3 py-1.5 text-pine/60 hover:bg-paper-deep"
                        onClick={() => setQuantity(item.variantId, item.quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="px-2 text-sm font-bold text-pine min-w-[2rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        className="px-3 py-1.5 text-pine/60 hover:bg-paper-deep"
                        onClick={() => setQuantity(item.variantId, item.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-display font-bold text-lg text-signal">
                      {money(parseFloat(item.price.amount) * item.quantity, item.price.currencyCode)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeItem(item.variantId)}
                    className="text-xs text-pine/45 hover:text-red-600 mt-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* summary */}
          <div>
            <div className="rounded-2xl bg-white border border-pine/10 p-6 lg:sticky lg:top-24">
              <h2 className="font-display font-bold uppercase tracking-wide text-lg text-pine mb-4">
                Order Summary
              </h2>
              <div className="flex justify-between text-sm text-pine/60 mb-2">
                <span>Subtotal</span>
                <span className="text-pine font-semibold">{money(subtotal, currencyCode)}</span>
              </div>
              <div className="flex justify-between text-sm text-pine/60 mb-4">
                <span>Shipping</span>
                <span>{remaining > 0 ? "Calculated at checkout" : "FREE"}</span>
              </div>
              <div className="border-t border-pine/10 pt-4 flex justify-between items-center mb-5">
                <span className="font-semibold text-pine">Total</span>
                <span className="font-display font-bold text-2xl text-signal">
                  {money(subtotal, currencyCode)}
                </span>
              </div>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="w-full rounded-xl bg-signal hover:bg-signal-dark disabled:opacity-50 text-white font-bold py-4 transition shadow-md"
              >
                {checkingOut ? "Redirecting to checkout…" : "Secure Checkout"}
              </button>
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-pine/45">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                Secure checkout powered by Shopify
              </div>
              <Link
                href="/"
                className="block text-center text-sm text-signal hover:text-signal-dark font-semibold mt-4"
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
