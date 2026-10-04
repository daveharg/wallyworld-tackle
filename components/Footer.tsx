"use client";

import { useState } from "react";
import Link from "next/link";

const SHOP_LINKS = [
  { label: "Rods", href: "/rods" },
  { label: "Reels", href: "/reels" },
  { label: "Jig Heads", href: "/tackle#jig-heads" },
  { label: "Soft Plastics", href: "/tackle#soft-plastics" },
  { label: "Hard Baits", href: "/tackle#hard-baits" },
  { label: "Tackle Boxes", href: "/tackle#tackle-boxes" },
  { label: "Tools & Accessories", href: "/tackle#tools" },
];

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="bg-pine-deep text-paper mt-16">
      {/* newsletter band */}
      <div className="border-b border-paper/10">
        <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h3 className="font-display font-bold text-2xl uppercase tracking-wide">
              Get the bite report
            </h3>
            <p className="text-paper/60 text-sm mt-1">
              New tackle drops, restocks, and subscriber-only deals. No spam, unsubscribe anytime.
            </p>
          </div>
          {subscribed ? (
            <p className="text-gold font-semibold">
              You&apos;re on the list — tight lines!
            </p>
          ) : (
            <form
              className="flex w-full md:w-auto gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.includes("@")) setSubscribed(true);
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                className="flex-1 md:w-72 rounded-lg bg-pine border border-paper/20 px-4 py-2.5 text-sm text-paper placeholder:text-paper/40 outline-none focus:border-signal"
              />
              <button
                type="submit"
                className="rounded-lg bg-signal hover:bg-signal-dark text-white font-bold text-sm px-5 py-2.5 transition whitespace-nowrap"
              >
                Sign Up
              </button>
            </form>
          )}
        </div>
      </div>

      {/* link columns */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-signal text-white font-display font-bold text-lg">
              W
            </span>
            <span className="font-display font-bold text-lg uppercase tracking-wide">
              Wallyworld <span className="text-signal">Tackle</span>
            </span>
          </div>
          <p className="italic text-paper/60 text-sm mb-3">good gear, low prices</p>
          <p className="text-paper/50 text-sm leading-relaxed">
            Freshwater fishing tackle chosen for value — rods, reels, jigs, plastics, hard
            baits and more, shipped direct from our suppliers.
          </p>
        </div>

        <div>
          <h4 className="font-display font-semibold uppercase tracking-widest text-sm mb-4">
            Shop
          </h4>
          <ul className="space-y-2.5">
            {SHOP_LINKS.map((l) => (
              <li key={l.href + l.label}>
                <Link href={l.href} className="text-sm text-paper/60 hover:text-signal transition">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold uppercase tracking-widest text-sm mb-4">
            Help
          </h4>
          <ul className="space-y-2.5 text-sm text-paper/60">
            <li>Free shipping on orders over $75</li>
            <li>Secure checkout via Shopify</li>
            <li>30-day hassle-free returns</li>
            <li>
              <Link href="/cart" className="hover:text-signal transition">
                View your cart
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold uppercase tracking-widest text-sm mb-4">
            Contact
          </h4>
          <ul className="space-y-2.5 text-sm text-paper/60">
            <li>Winnipeg, Manitoba, Canada</li>
            <li>Mon–Fri, 9am–5pm CT</li>
            <li className="text-paper/40">We reply within 1 business day.</li>
          </ul>
        </div>
      </div>

      {/* bottom bar */}
      <div className="border-t border-paper/10">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-paper/40">
            © {new Date().getFullYear()} Wallyworld Tackle. All rights reserved.
          </p>
          <div className="flex items-center gap-2" aria-label="Accepted payments">
            {["VISA", "MC", "AMEX", "PayPal", "Apple Pay"].map((p) => (
              <span
                key={p}
                className="text-[10px] font-bold tracking-wide text-paper/50 border border-paper/20 rounded px-2 py-1"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
