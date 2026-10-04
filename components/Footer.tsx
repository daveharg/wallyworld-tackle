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
    <footer className="bg-night-950 border-t border-night-700 mt-16">
      {/* newsletter band */}
      <div className="border-b border-night-800">
        <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h3 className="font-display font-bold text-2xl uppercase tracking-wide text-white">
              Get the bite report
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              New tackle drops, restocks, and subscriber-only deals. No spam, unsubscribe anytime.
            </p>
          </div>
          {subscribed ? (
            <p className="text-ember-400 font-semibold">
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
                className="flex-1 md:w-72 rounded-lg bg-night-800 border border-night-600 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-ember-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-ember-500 hover:bg-ember-600 text-night-950 font-bold text-sm px-5 py-2.5 transition whitespace-nowrap"
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
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-ember-400 to-ember-600 text-night-950 font-display font-bold text-lg">
              W
            </span>
            <span className="font-display font-bold text-lg uppercase tracking-wide text-white">
              Wallyworld <span className="text-ember-500">Tackle</span>
            </span>
          </div>
          <p className="italic text-slate-400 text-sm mb-3">good gear, low prices</p>
          <p className="text-slate-500 text-sm leading-relaxed">
            Freshwater fishing tackle chosen for value — rods, reels, jigs, plastics, hard
            baits and more, shipped direct from our suppliers.
          </p>
        </div>

        <div>
          <h4 className="font-display font-semibold uppercase tracking-widest text-sm text-white mb-4">
            Shop
          </h4>
          <ul className="space-y-2.5">
            {SHOP_LINKS.map((l) => (
              <li key={l.href + l.label}>
                <Link href={l.href} className="text-sm text-slate-400 hover:text-ember-400 transition">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold uppercase tracking-widest text-sm text-white mb-4">
            Help
          </h4>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li>Free shipping on orders over $75</li>
            <li>Secure checkout via Shopify</li>
            <li>30-day hassle-free returns</li>
            <li>
              <Link href="/cart" className="hover:text-ember-400 transition">
                View your cart
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold uppercase tracking-widest text-sm text-white mb-4">
            Contact
          </h4>
          <ul className="space-y-2.5 text-sm text-slate-400">
            <li>Winnipeg, Manitoba, Canada</li>
            <li>Mon–Fri, 9am–5pm CT</li>
            <li className="text-slate-500">We reply within 1 business day.</li>
          </ul>
        </div>
      </div>

      {/* bottom bar */}
      <div className="border-t border-night-800">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Wallyworld Tackle. All rights reserved.
          </p>
          <div className="flex items-center gap-2" aria-label="Accepted payments">
            {["VISA", "MC", "AMEX", "PayPal", "Apple Pay"].map((p) => (
              <span
                key={p}
                className="text-[10px] font-bold tracking-wide text-slate-400 border border-night-600 rounded px-2 py-1 bg-night-900"
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
