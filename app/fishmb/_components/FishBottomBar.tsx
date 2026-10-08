"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useFishAuth } from "./FishAuth";

type Item = {
  href: string;
  label: string;
  match: (pathname: string, sp: URLSearchParams) => boolean;
  icon: React.ReactNode;
};

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS = {
  community: (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5" />
      <circle cx="17.5" cy="9.5" r="2.5" />
      <path d="M17 15.5c2.5.3 4 1.7 4.7 4" />
    </svg>
  ),
  catches: (
    <svg {...iconProps}>
      <path d="M6.5 12c2.5-3.5 6-5.5 10-5.5 0 0-1.5 2.5-1.5 5.5S16.5 17.5 16.5 17.5c-4 0-7.5-2-10-5.5Z" />
      <path d="M6.5 12 3.5 9.5v5L6.5 12Z" />
    </svg>
  ),
  buddies: (
    <svg {...iconProps}>
      <path d="M12 21c-4.5-2-7-5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 12c0 4-2.5 7-7 9Z" />
    </svg>
  ),
  dashboard: (
    <svg {...iconProps}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
      <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
      <rect x="3.5" y="13" width="7" height="7.5" rx="1.5" />
    </svg>
  ),
  maps: (
    <svg {...iconProps}>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  ),
  weather: (
    <svg {...iconProps}>
      <circle cx="8" cy="8" r="3.5" />
      <path d="M8 2.5v1.5M2.5 8h1.5M4.2 4.2l1 1M11.8 4.2l-1 1" />
      <path d="M10 20h8.5a3.5 3.5 0 0 0 .6-6.95A5.5 5.5 0 0 0 8.3 14.6 3 3 0 0 0 10 20Z" />
    </svg>
  ),
};

const LEFT: Item[] = [
  {
    href: "/fishmb/feed",
    label: "Community",
    icon: ICONS.community,
    match: (p, sp) => p === "/fishmb/feed" && sp.get("kind") !== "catch" && sp.get("friends") !== "1",
  },
  {
    href: "/fishmb/feed?kind=catch",
    label: "Catches",
    icon: ICONS.catches,
    match: (p, sp) => p === "/fishmb/feed" && sp.get("kind") === "catch",
  },
  {
    href: "/fishmb/feed?friends=1",
    label: "Buddies",
    icon: ICONS.buddies,
    match: (p, sp) => p === "/fishmb/feed" && sp.get("friends") === "1",
  },
];

const RIGHT: Item[] = [
  { href: "/fishmb/dashboard", label: "Dashboard", icon: ICONS.dashboard, match: (p) => p.startsWith("/fishmb/dashboard") || p.startsWith("/fishmb/profile") },
  { href: "/fishmb/lakes", label: "Maps", icon: ICONS.maps, match: (p) => p.startsWith("/fishmb/lakes") },
  { href: "/fishmb/weather", label: "Weather", icon: ICONS.weather, match: (p) => p.startsWith("/fishmb/weather") },
];

function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useFishAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let stop = false;
    async function check() {
      try {
        if (!user || stop) return;
        const r = await fetch("/api/fishmb/msg/unread", { credentials: "include" });
        if (r.ok) {
          const d = await r.json();
          if (!stop) setUnread(d.unread ?? 0);
        }
      } catch {
        // non-fatal
      }
    }
    check();
    const t = setInterval(check, 60000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [user]);

  // Tournament full-screen leaderboard stays bare.
  if (pathname.startsWith("/fishmb/tournaments/") && pathname.endsWith("/leaderboard")) return null;

  const sp = new URLSearchParams(searchParams.toString());
  const renderItem = (item: Item) => {
    const active = item.match(pathname, sp);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-label={item.label}
        className={`relative flex flex-col items-center justify-center gap-0.5 w-11 py-1.5 rounded-2xl transition-colors ${
          active ? "text-amber-300" : "text-white/55 hover:text-white"
        }`}
      >
        {item.icon}
        <span className="text-[9px] font-bold leading-none">{item.label}</span>
        {active && <span className="absolute bottom-0 w-6 h-0.5 rounded-full bg-amber-300" />}
      </Link>
    );
  };

  return (
    <nav
      aria-label="FishMB sections"
      className="md:hidden fixed z-40 left-1/2 -translate-x-1/2"
      style={{ bottom: "calc(0.7rem + env(safe-area-inset-bottom))" }}
    >
      <div className="relative flex items-end gap-0.5 bg-[#12241c]/95 backdrop-blur rounded-[1.75rem] shadow-[0_10px_36px_rgba(0,0,0,0.35)] border border-white/10 px-2 py-1.5">
        {LEFT.map(renderItem)}
        <Link
          href="/fishmb/feed?compose=1"
          aria-label="New post"
          className="mx-0.5 -mt-8 w-14 h-14 rounded-full bg-signal hover:bg-signal-dark text-white shadow-[0_8px_24px_rgba(0,0,0,0.4)] border-4 border-[#12241c] flex items-center justify-center transition-colors"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
        {RIGHT.map(renderItem)}
        {/* Messages stays one tap away via a badge while the bar is full */}
        {unread > 0 && (
          <Link
            href="/fishmb/messages"
            aria-label={`Messages, ${unread} unread`}
            className="absolute -top-2 -right-1 min-w-5 h-5 px-1 rounded-full bg-signal text-white text-[10px] font-black flex items-center justify-center"
          >
            {unread > 99 ? "99+" : unread}
          </Link>
        )}
      </div>
    </nav>
  );
}

export default function FishBottomBar() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
