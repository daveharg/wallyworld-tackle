"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FishLoginButton, useFishAuth } from "./FishAuth";

const NAV = [
  { href: "/fishmb/lakes", label: "Lakes" },
  { href: "/fishmb/lodges", label: "Lodges & Guides" },
  { href: "/fishmb/regulations", label: "Regulations" },
  { href: "/fishmb/hot-lakes", label: "Hot Lakes" },
  { href: "/fishmb/tournaments", label: "Tournaments" },
  { href: "/fishmb/tips", label: "Tips" },
  { href: "/fishmb/feed", label: "The Feed" },
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
  const { user, openLogin, logout } = useFishAuth();
  return (
    <header className="sticky top-0 z-40 bg-paper/95 backdrop-blur border-b border-pine/10">
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
          <div className="flex items-center gap-3">
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
        <nav className="md:hidden border-t border-pine/10 bg-paper px-4 py-3 flex flex-col gap-1">
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
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="mt-2 inline-flex justify-center bg-pine/10 text-pine text-sm font-bold uppercase tracking-wider px-5 py-3 rounded-full"
            >
              Log out ({user.name})
            </button>
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
        </nav>
      )}
    </header>
  );
}
