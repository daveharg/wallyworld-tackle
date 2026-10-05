"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCart } from "./CartContext";
import AuthModal from "./AuthModal";
import AccountMenu from "./AccountMenu";
import { CATEGORIES } from "../lib/categories";

const CAT_NAV = [
  { label: "Rods", href: "/rods" },
  { label: "Reels", href: "/reels" },
  { label: "Hard Baits", href: "/tackle#hard-baits" },
  { label: "Soft Plastics", href: "/tackle#soft-plastics" },
  { label: "Jig Heads", href: "/tackle#jig-heads" },
  { label: "Tackle Boxes", href: "/tackle#tackle-boxes" },
  { label: "Tools & Accessories", href: "/tackle#tools" },
  { label: "Walleye", href: "/#walleye-picks", hot: true },
];

function SearchBox({ onDone, large }: { onDone?: () => void; large?: boolean }) {
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
        aria-label="Search products"
        className={`w-full rounded-full bg-paper-deep/60 border border-pine/20 placeholder:text-pine/40 text-pine outline-none focus:border-signal focus:bg-white transition ${
          large ? "text-[15px] py-3.5 pl-6 pr-14" : "text-sm py-2.5 pl-4 pr-11"
        }`}
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-signal hover:bg-signal-dark text-white p-2 transition"
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
  const { status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const loggedIn = status === "authenticated";

  return (
    <>
      {/* 1 — announcement bar (dismissible) */}
      {bannerOpen && (
        <div className="bg-pine-deep text-white text-center text-[13px] py-2 px-10 relative">
          <span className="font-semibold">
            Free shipping — good gear, low prices
          </span>{" "}
          <Link href="/rods" className="underline font-bold text-gold hover:text-white transition">
            Shop Now
          </Link>
          <button
            onClick={() => setBannerOpen(false)}
            aria-label="Dismiss announcement"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      )}

      {/* 2 — utility bar */}
      <div className="hidden md:block bg-pine text-paper/75 text-xs">
        <div className="max-w-7xl mx-auto px-4 h-8 flex items-center justify-between">
          <span className="font-semibold tracking-wide">Wallyworld Tackle · Winnipeg, MB</span>
          <span className="font-medium">Free shipping</span>
          <nav className="flex items-center gap-5" aria-label="Utility">
            <Link href="/#walleye-picks" className="hover:text-white transition">Walleye Picks</Link>
            <Link href="/#playbook" className="hover:text-white transition">Help</Link>
            <Link href="#contact" className="hover:text-white transition">Contact</Link>
          </nav>
        </div>
      </div>

      {/* 3 — main header + 4 — category nav (sticky) */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_1px_0_rgba(18,50,43,0.12)]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 md:gap-8 h-[72px] md:h-20">
            {/* hamburger (mobile) */}
            <button
              className="md:hidden p-2 -ml-2 text-pine"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>

            {/* brand */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <span className="grid place-items-center w-10 h-10 md:w-11 md:h-11 rounded-lg bg-pine text-white font-display font-bold text-xl">
                W
              </span>
              <span className="leading-none">
                <span className="block font-display font-bold text-xl md:text-2xl uppercase tracking-wide text-pine">
                  Wallyworld Tackle
                </span>
                <span className="hidden sm:block text-[11px] italic text-pine/55 mt-0.5">
                  good gear, low prices
                </span>
              </span>
            </Link>

            {/* big centered search (desktop) */}
            <div className="hidden md:block flex-1 max-w-2xl mx-auto">
              <SearchBox large />
            </div>

            {/* account + cart */}
            <div className="flex items-center gap-1 md:gap-2 ml-auto md:ml-0">
              {loggedIn ? (
                <AccountMenu />
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="flex items-center gap-2 rounded-full bg-pine hover:bg-pine-deep text-white transition pl-3 pr-4 py-2.5 md:pl-4 md:pr-5 shadow-md"
                  aria-label="Sign in or join Wallyworld Rewards"
                  title="Sign in / Join Rewards"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
                  </svg>
                  <span className="text-sm font-bold whitespace-nowrap">
                    Sign In
                    <span className="hidden md:inline font-semibold text-gold"> · Join Rewards</span>
                  </span>
                </button>
              )}
              <button
                onClick={openDrawer}
                className="relative grid place-items-center w-11 h-11 rounded-full bg-signal hover:bg-signal-dark text-white transition shadow-md"
                aria-label={`Open cart, ${count} items`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="20" r="1.6" />
                  <circle cx="17" cy="20" r="1.6" />
                  <path d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20.5 7H6" />
                </svg>
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 grid place-items-center rounded-full bg-pine text-white text-[11px] font-bold border-2 border-white">
                    {count}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* search (mobile) */}
          <div className="md:hidden pb-3">
            <SearchBox onDone={() => setMenuOpen(false)} />
          </div>
        </div>

        {/* 4 — category nav */}
        <nav className="hidden md:block border-t border-pine/10" aria-label="Shop categories">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-center gap-1">
            {CAT_NAV.map((c) => (
              <Link
                key={c.label}
                href={c.href}
                className={`px-5 py-3 font-display font-semibold uppercase tracking-wider text-[15px] transition border-b-[3px] ${
                  c.hot
                    ? "text-signal border-signal hover:bg-signal/5"
                    : "text-pine border-transparent hover:text-signal hover:border-signal"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* mobile category row */}
        <nav className="md:hidden flex gap-1 overflow-x-auto no-scrollbar border-t border-pine/10 px-4 py-2" aria-label="Shop categories">
          {CAT_NAV.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              onClick={() => setMenuOpen(false)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-bold uppercase tracking-wider whitespace-nowrap ${
                c.hot ? "text-signal bg-signal/10" : "text-pine/75 hover:text-pine"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </nav>

        {/* expanded mobile menu: all categories */}
        {menuOpen && (
          <nav className="md:hidden border-t border-pine/10 bg-paper-deep animate-fade-in">
            <div className="px-4 py-3">
              {!loggedIn && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setAuthOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-pine text-white font-bold py-3 mb-3 shadow-md"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
                  </svg>
                  Sign In · Join Wallyworld Rewards
                </button>
              )}
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

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
