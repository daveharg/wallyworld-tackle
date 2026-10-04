"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export default function AccountMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  useEffect(() => {
    if (session) {
      fetch("/api/points")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setPoints(j.balance))
        .catch(() => {});
    }
  }, [session]);

  const initial = (session?.user?.name ?? session?.user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="relative grid place-items-center w-11 h-11 rounded-full bg-pine text-white font-display font-bold text-lg hover:bg-pine-deep transition"
        title={session?.user?.email ?? "Account"}
      >
        {initial}
        {points !== null && points > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 grid place-items-center rounded-full bg-gold text-white text-[10px] font-bold border-2 border-white">
            {points >= 1000 ? `${Math.floor(points / 1000)}k` : points}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-2xl border border-pine/10 overflow-hidden z-50 animate-fade-in">
          <div className="px-5 py-4 bg-paper-deep border-b border-pine/10">
            <p className="font-bold text-pine truncate">{session?.user?.name ?? "Angler"}</p>
            <p className="text-xs text-pine/55 truncate">{session?.user?.email}</p>
            {points !== null && (
              <p className="text-sm font-bold text-gold mt-1.5">
                {points} reward points
              </p>
            )}
          </div>
          <nav className="py-2" aria-label="Account">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block px-5 py-2.5 text-sm font-semibold text-pine hover:bg-paper-deep hover:text-signal transition"
            >
              My Account
            </Link>
            <Link
              href="/account/points"
              onClick={() => setOpen(false)}
              className="block px-5 py-2.5 text-sm font-semibold text-pine hover:bg-paper-deep hover:text-signal transition"
            >
              Loyalty Points
            </Link>
            <Link
              href="/account#orders"
              onClick={() => setOpen(false)}
              className="block px-5 py-2.5 text-sm font-semibold text-pine hover:bg-paper-deep hover:text-signal transition"
            >
              Order History
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full text-left px-5 py-2.5 text-sm font-semibold text-pine/60 hover:bg-paper-deep hover:text-red-600 transition"
            >
              Sign Out
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
