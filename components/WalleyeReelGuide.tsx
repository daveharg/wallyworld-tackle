"use client";

import { useState } from "react";

/**
 * Flashy walleye reel buying guide for the top of the Reels page.
 * Recommends 2000-size and explains why light is right for walleye.
 */
export default function WalleyeReelGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="max-w-7xl mx-auto px-4 pt-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7f1d1d] via-[#991b1b] to-[#b91c1c] text-white">
        {/* Decorative elements */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-gold/10" />
        <div className="absolute -left-8 -bottom-20 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute right-8 top-8 text-6xl opacity-10">🌀</div>

        <div className="relative p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold mb-2">
                Walleye Guide
              </p>
              <h2 className="font-display font-bold uppercase text-2xl md:text-3xl tracking-wide">
                What reel do you need for walleye?
              </h2>
              <p className="text-white/70 mt-2 max-w-2xl text-sm md:text-base">
                Go light. You don't need a big reel for walleye — here's why the
                2000 size is the sweet spot.
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
              {/* 2000 Size */}
              <div className="rounded-xl bg-white/5 border border-gold/30 p-5 backdrop-blur relative">
                <div className="absolute -top-3 left-4 rounded-full bg-gold text-pine-deep text-xs font-bold px-3 py-1 uppercase tracking-wide">
                  Our pick
                </div>
                <div className="text-2xl mb-2 mt-1">⭐</div>
                <h3 className="font-display font-bold uppercase tracking-wide text-gold mb-2">
                  2000 Size — Best for Walleye
                </h3>
                <ul className="text-sm text-white/80 space-y-1.5">
                  <li><strong className="text-white">Weight:</strong> Light — less fatigue all day</li>
                  <li><strong className="text-white">Line:</strong> Holds plenty of 10 lb braid</li>
                  <li><strong className="text-white">Balance:</strong> Perfect on 6'3" – 7' rods</li>
                </ul>
                <p className="text-xs text-white/60 mt-3">
                  Walleye don't make long runs, so you don't need a big spool.
                  A 2000 is lighter, balances better, and wastes less line.
                </p>
              </div>

              {/* 2500-3000 */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 backdrop-blur">
                <div className="text-2xl mb-2">⚖️</div>
                <h3 className="font-display font-bold uppercase tracking-wide text-white mb-2">
                  2500–3000 Size
                </h3>
                <ul className="text-sm text-white/80 space-y-1.5">
                  <li><strong className="text-white">When:</strong> Longer 7'+ rods, heavier line</li>
                  <li><strong className="text-white">Use:</strong> Bigger lures, windy days</li>
                  <li><strong className="text-white">Trade-off:</strong> Slightly heavier</li>
                </ul>
                <p className="text-xs text-white/60 mt-3">
                  Steps up when you need more line capacity or a bit more
                  cranking power. Still great for walleye.
                </p>
              </div>

              {/* Gear Ratio */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 backdrop-blur">
                <div className="text-2xl mb-2">⚙️</div>
                <h3 className="font-display font-bold uppercase tracking-wide text-white mb-2">
                  Gear Ratio & Line
                </h3>
                <ul className="text-sm text-white/80 space-y-1.5">
                  <li><strong className="text-white">Ratio:</strong> 5.2:1 – 6.2:1 is ideal</li>
                  <li><strong className="text-white">Line:</strong> 10 lb braid + 6–10 lb fluoro leader</li>
                  <li><strong className="text-white">Why braid:</strong> Sensitivity + hookset power</li>
                </ul>
                <p className="text-xs text-white/60 mt-3">
                  Braid telegraphs every tick. The fluoro leader adds stealth
                  near the bait.
                </p>
              </div>
            </div>
          )}

          {open && (
            <div className="mt-6 rounded-xl bg-gold/10 border border-gold/20 p-4">
              <p className="text-sm text-white/80">
                <strong className="text-gold">Why light wins:</strong> A lighter reel
                means less arm fatigue over hundreds of casts, better rod balance
                for detecting subtle bites, and you simply don't need 200+ yards
                of line for walleye. Save the big reels for pike and musky.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
