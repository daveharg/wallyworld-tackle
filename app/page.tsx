"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "../../components/CartContext";
import { createCheckoutUrl, isShopifyConfigured } from "../../lib/shopify";

export default function CartPage() {
  const { items, count, subtotal, currencyCode, setQuantity, removeItem, clear } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const formattedSubtotal = (() => {
    try {
      return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: currencyCode,
      }).format(subtotal);
    } catch {
      return `$${subtotal.toFixed(2)}`;
    }
  })();

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

  if (items.length === 0) {
    return (
      <div className="cart-page">
        <h1>Your Cart</h1>
        <div className="cart-empty">
          <p>Your cart is empty.</p>
          <Link href="/" className="btn" style={{ marginTop: "1rem" }}>
            Keep shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>Your Cart ({count})</h1>

      {items.map((item) => (
        <div className="cart-line" key={item.variantId}>
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.productTitle} />
          ) : (
            <div style={{ width: 80, height: 80, background: "#f5f5f4", borderRadius: 8 }} />
          )}
          <div className="cart-line-info">
            <h3>
              <Link href={`/products/${item.productHandle}`}>{item.productTitle}</Link>
            </h3>
            <p className="cart-line-variant">{item.variantLabel}</p>
            <div className="qty-control" style={{ display: "inline-flex" }}>
              <button
                type="button"
                onClick={() => setQuantity(item.variantId, item.quantity - 1)}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span>{item.quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(item.variantId, item.quantity + 1)}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>{" "}
            <button
              type="button"
              onClick={() => removeItem(item.variantId)}
              style={{
                background: "none",
                border: "none",
                color: "#b91c1c",
                cursor: "pointer",
                fontSize: "0.85rem",
                marginLeft: "0.5rem",
              }}
            >
              Remove
            </button>
          </div>
          <div className="cart-line-price">
            {(() => {
              try {
                return new Intl.NumberFormat("en-CA", {
                  style: "currency",
                  currency: item.price.currencyCode,
                }).format(parseFloat(item.price.amount) * item.quantity);
              } catch {
                return `$${(parseFloat(item.price.amount) * item.quantity).toFixed(2)}`;
              }
            })()}
          </div>
        </div>
      ))}

      <div className="cart-summary">
        <div className="cart-summary-row">
          <span>Subtotal</span>
          <span>{formattedSubtotal}</span>
        </div>
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
        <button type="button" className="btn" onClick={handleCheckout} disabled={checkingOut}>
          {checkingOut ? "Redirecting to checkout…" : "Checkout"}
        </button>
        <p style={{ fontSize: "0.85rem", color: "#78716c", marginTop: "0.75rem" }}>
          Secure checkout powered by Shopify.
        </p>
      </div>
    </div>
  );
}
