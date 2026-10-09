"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FishLoginButton, useFishAuth } from "./FishAuth";

const NAV = [
  { href: "/fishmb", label: "Home" },
  { href: "/fishmb/lakes", label: "Lakes" },
  { href: "/fishmb/lodges", label: "Lodges & Guides" },
  { href: "/fishmb/regulations", label: "Regulations" },
  { href: "/fishmb/hot-lakes", label: "Hot Lakes" },
  { href: "/fishmb/tournaments", label: "Tournaments" },
  { href: "/fishmb/tips", label: "Tips" },
  { href: "/fishmb/feed", label: "The Feed" },
  { href: "/fishmb/classifieds", label: "Classifieds" },
];

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="font-display font-bold uppercase tracking-wide text-2xl md:text-[1.7rem] leading-none">
      <span className={light ? "text-white" : "text-pine"}>Fish</span>
      <span className="text-signal">MB</span>
    </span>
  );
}

export default function FishHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { user, openLogin, logout } = useFishAuth();

  // Keep the scroll handler reading the latest menu state without re-binding.
  const openRef = useRef(open);
  openRef.current = open;

  // Hide the header when scrolling down, show it immediately on scroll up.
  useEffect(() => {
    setHidden(false);
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const scrollingDown = y > lastY;
        if (!openRef.current) {
          if (scrollingDown && y > 120) setHidden(true);
          else if (!scrollingDown) setHidden(false);
        }
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-40 bg-paper/95 backdrop-blur border-b border-pine/10 transition-transform duration-300 ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/fishmb" aria-label="FishMB home">
            <Wordmark />
          </Link>
          <nav className="hidden md:flex items-center gap-7">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`text-sm font-bold uppercase tracking-wider transition-colors ${
                  pathname?.startsWith(n.href)
                    ? "text-signal"
                    : "text-pine/70 hover:text-pine"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/fishmb/app"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pine/70 hover:text-signal border border-pine/20 hover:border-signal rounded-full px-4 py-2 transition-colors"
            >
              📱 Get the app
            </Link>
            <FishLoginButton />
            <button
              className="md:hidden p-2 text-pine"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>
      {open && (
        <nav
          className="md:hidden border-t border-pine/10 bg-paper px-4 py-3 flex flex-col gap-1"
          onClick={() => setOpen(false)}
        >
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`py-2.5 text-sm font-bold uppercase tracking-wider ${
                pathname?.startsWith(n.href) ? "text-signal" : "text-pine/70"
              }`}
            >
              {n.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                href="/fishmb/dashboard"
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-bold uppercase tracking-wider text-signal"
              >
                📊 Dashboard
              </Link>
              <Link
                href="/fishmb/profile"
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-bold uppercase tracking-wider text-signal"
              >
                👤 My profile
              </Link>
              <Link
                href="/fishmb/friends"
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70"
              >
                Friends
              </Link>
              <Link
                href="/fishmb/messages"
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70"
              >
                💬 Messages
              </Link>
              <button
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
                className="mt-2 inline-flex justify-center bg-pine/10 text-pine text-sm font-bold uppercase tracking-wider px-5 py-3 rounded-full"
              >
                Log out ({user.name})
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setOpen(false);
                openLogin();
              }}
              className="mt-2 inline-flex justify-center bg-signal text-white text-sm font-bold uppercase tracking-wider px-5 py-3 rounded-full"
            >
              Log in
            </button>
          )}
          <Link
            href="/fishmb/app"
            onClick={() => setOpen(false)}
            className="py-2.5 text-sm font-bold uppercase tracking-wider text-pine/70"
          >
            📱 Get the app
          </Link>
          <div className="mt-3 mb-2 bg-gold/15 border border-gold/40 rounded-2xl p-4">
            <p className="text-sm font-bold text-pine">🧪 FishMB is in beta</p>
            <p className="text-xs text-pine/65 mt-1 leading-relaxed">
              We&apos;re still building — things might break or look rough around the edges.
              Got an idea for a feature or spotted a bug? Tell us and we&apos;ll take a look.
            </p>
            <Link
              href="/fishmb/contact"
              onClick={() => setOpen(false)}
              className="inline-block mt-2.5 text-xs font-bold uppercase tracking-wider text-signal-dark"
            >
              Suggest a feature / report a bug →
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
