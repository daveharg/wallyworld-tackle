"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "./CartContext";
import { CATEGORIES } from "../lib/categories";

const NAV = [
  { label: "Rods", href: "/rods" },
  { label: "Reels", href: "/reels" },
  { label: "Tackle & More", href: "/tackle" },
  { label: "Playbook", href: "/#playbook" },
];

function SearchBox({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) {
          router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          onDone?.();
        }
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search rods, reels, lures…"
        className="w-full rounded-full bg-white border border-pine/15 placeholder:text-pine/40 text-pine text-sm py-2.5 pl-4 pr-11 outline-none focus:border-signal transition"
        aria-label="Search products"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-signal hover:bg-signal-dark text-white p-2 transition"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}

export default function Header() {
  const { count, openDrawer } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* announcement bar */}
      <div className="bg-pine-deep text-paper text-center text-[13px] font-semibold tracking-wide py-2 px-3">
        <span className="font-display uppercase">Free shipping on orders over $75</span>
        <span className="hidden sm:inline text-paper/60 font-body font-medium"> &nbsp;·&nbsp; good gear, low prices</span>
      </div>

      <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur border-b border-pine/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 md:gap-6 h-16 md:h-[72px]">
            {/* hamburger (mobile) */}
            <button
              className="md:hidden p-2 -ml-2 text-pine"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6 6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>

            {/* brand */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-signal text-white font-display font-bold text-xl shadow-md group-hover:scale-105 transition">
                W
              </span>
              <span className="leading-none">
                <span className="block font-display font-bold text-xl md:text-2xl uppercase tracking-wide text-pine">
                  Wallyworld <span className="text-signal">Tackle</span>
                </span>
                <span className="hidden sm:block text-[11px] italic text-pine/60 mt-0.5">
                  good gear, low prices
                </span>
              </span>
            </Link>

            {/* desktop nav */}
            <nav className="hidden md:flex items-center gap-1 ml-2">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-pine/80 hover:text-pine hover:bg-paper-deep transition"
                >
                  {n.label}
                </Link>
              ))}
            </nav>

            {/* search (desktop) */}
            <div className="hidden md:block flex-1 max-w-sm ml-auto">
              <SearchBox />
            </div>

            {/* cart */}
            <button
              onClick={openDrawer}
              className="relative ml-auto md:ml-0 flex items-center gap-2 rounded-full bg-signal hover:bg-signal-dark text-white font-bold text-sm px-4 py-2.5 transition shadow-md"
              aria-label={`Open cart, ${count} items`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="20" r="1.6" />
                <circle cx="17" cy="20" r="1.6" />
                <path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20.5 7H6" />
              </svg>
              <span className="hidden sm:inline">Cart</span>
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 grid place-items-center rounded-full bg-pine text-white text-[11px] font-bold border-2 border-signal">
                  {count}
                </span>
              )}
            </button>
          </div>

          {/* mobile: single scrollable nav row */}
          <nav className="md:hidden flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2.5" aria-label="Shop">
            {[{ label: "Home", href: "/" }, ...NAV].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className="shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-bold uppercase tracking-wider text-pine/75 hover:text-pine hover:bg-paper-deep whitespace-nowrap"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {/* search (mobile) */}
          <div className="md:hidden pb-3">
            <SearchBox onDone={() => setMenuOpen(false)} />
          </div>
        </div>

        {/* mobile category chips (expanded menu) */}
        {menuOpen && (
          <nav className="md:hidden border-t border-pine/10 bg-paper-deep animate-fade-in">
            <div className="px-4 py-3">
              <div className="text-xs text-pine/50 uppercase tracking-widest font-semibold mb-2">
                Shop by category
              </div>
              <div className="flex flex-wrap gap-2 pb-1">
                {CATEGORIES.map((c) => (
                  <Link
                    key={c.key}
                    href={c.href}
                    onClick={() => setMenuOpen(false)}
                    className="text-xs font-semibold bg-white border border-pine/15 rounded-full px-3 py-1.5 text-pine/80"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
