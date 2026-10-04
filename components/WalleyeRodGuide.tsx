"use client";

import { useState } from "react";

/**
 * Flashy walleye rod buying guide for the top of the Rods page.
 * Explains what rod to get for walleye: jigging vs casting sizes, power, action.
 */
export default function WalleyeRodGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="max-w-7xl mx-auto px-4 pt-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pine-deep via-pine to-[#1a3a2e] text-white">
        {/* Decorative elements */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-gold/10" />
        <div className="absolute -left-8 -bottom-20 w-48 h-48 rounded-full bg-gold/5" />
        <div className="absolute right-8 top-8 text-6xl opacity-10">🎣</div>

        <div className="relative p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold mb-2">
                Walleye Guide
              </p>
              <h2 className="font-display font-bold uppercase text-2xl md:text-3xl tracking-wide">
                What rod do you need for walleye?
              </h2>
              <p className="text-white/70 mt-2 max-w-2xl text-sm md:text-base">
                Walleye bite light, so sensitivity is everything. Here's how to pick
                the right rod for how you fish.
              </p>
            </div>
            <button
              onClick={() => setOpen(!open)}
              className="shrink-0 rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-semibold transition"
              aria-expanded={open}
            >
              {open ? "Hide" : "Show"}
            </button>
          </div>

          {open && (
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              {/* Vertical Jigging */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 backdrop-blur">
                <div className="text-2xl mb-2">⬇️</div>
                <h3 className="font-display font-bold uppercase tracking-wide text-gold mb-2">
                  Vertical Jigging
                </h3>
                <ul className="text-sm text-white/80 space-y-1.5">
                  <li><strong className="text-white">Length:</strong> 6'3" – 6'9"</li>
                  <li><strong className="text-white">Power:</strong> Medium-light</li>
                  <li><strong className="text-white">Action:</strong> Fast or extra-fast</li>
                </ul>
                <p className="text-xs text-white/60 mt-3">
                  Shorter rod for dropping jigs straight below the boat. Maximum
                  feel for those subtle "tick" bites.
                </p>
              </div>

              {/* Casting Jigs */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 backdrop-blur">
                <div className="text-2xl mb-2">🎯</div>
                <h3 className="font-display font-bold uppercase tracking-wide text-gold mb-2">
                  Casting Jigs
                </h3>
                <ul className="text-sm text-white/80 space-y-1.5">
                  <li><strong className="text-white">Length:</strong> 6'9" – 7'2"</li>
                  <li><strong className="text-white">Power:</strong> Medium</li>
                  <li><strong className="text-white">Action:</strong> Fast</li>
                </ul>
                <p className="text-xs text-white/60 mt-3">
                  Longer rod for distance and better hooksets when the bite comes
                  30+ feet away. Handles jigs up to 3/4 oz.
                </p>
              </div>

              {/* All-Round / Trolling */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 backdrop-blur">
                <div className="text-2xl mb-2">🔄</div>
                <h3 className="font-display font-bold uppercase tracking-wide text-gold mb-2">
                  All-Round & Trolling
                </h3>
                <ul className="text-sm text-white/80 space-y-1.5">
                  <li><strong className="text-white">Length:</strong> 6'6" – 7' (all-round), 7' – 8'6"+ (trolling)</li>
                  <li><strong className="text-white">Power:</strong> Medium-light to medium</li>
                  <li><strong className="text-white">Action:</strong> Fast (all-round), moderate (trolling)</li>
                </ul>
                <p className="text-xs text-white/60 mt-3">
                  One rod for everything, or go long with a softer action for
                  trolling crankbaits and planer boards.
                </p>
              </div>
            </div>
          )}

          {open && (
            <div className="mt-6 rounded-xl bg-gold/10 border border-gold/20 p-4">
              <p className="text-sm text-white/80">
                <strong className="text-gold">Pro tip:</strong> Go as light as you can.
                A lighter rod transmits more feel, so you'll detect bites you'd miss
                with a heavier stick. Pair it with a 2000-size reel and 10 lb braid
                for the ultimate walleye setup.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
