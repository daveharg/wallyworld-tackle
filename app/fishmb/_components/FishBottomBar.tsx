"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useFishAuth } from "./FishAuth";
import { fishFetch } from "./fishFetch";

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
  messages: (
    <svg {...iconProps}>
      <path d="M4 6.5h16v10H9l-5 4v-4H4v-10Z" />
      <path d="M8 10.5h8M8 13.5h5" />
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
    label: "Feed",
    icon: ICONS.community,
    match: (p, sp) => p === "/fishmb/feed" && sp.get("friends") !== "1",
  },
  {
    href: "/fishmb/feed?friends=1",
    label: "Friends",
    icon: ICONS.buddies,
    match: (p, sp) => p === "/fishmb/feed" && sp.get("friends") === "1",
  },
  {
    href: "/fishmb/dashboard",
    label: "Dashboard",
    icon: ICONS.dashboard,
    match: (p) => p.startsWith("/fishmb/dashboard") || p.startsWith("/fishmb/profile"),
  },
];

const RIGHT: Item[] = [
  { href: "/fishmb/maps", label: "Maps", icon: ICONS.maps, match: (p) => p.startsWith("/fishmb/maps") || p.startsWith("/fishmb/lakes") },
  { href: "/fishmb/weather", label: "Weather", icon: ICONS.weather, match: (p) => p.startsWith("/fishmb/weather") },
  { href: "/fishmb/messages", label: "Messages", icon: ICONS.messages, match: (p) => p.startsWith("/fishmb/messages") },
];

function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, openLogin } = useFishAuth();
  const [unread, setUnread] = useState(0);
  const [postGateOpen, setPostGateOpen] = useState(false);

  useEffect(() => {
    let stop = false;
    async function check() {
      try {
        if (!user || stop) return;
        // fishFetch attaches the FishMB bearer token — a bare fetch with
        // credentials:include never authenticates, so the badge stayed 0.
        const d = await fishFetch("/api/fishmb/msg/unread");
        if (!stop) setUnread((d as { unread?: number }).unread ?? 0);
      } catch {
        // non-fatal (signed out, offline, etc.)
      }
    }
    check();
    const t = setInterval(check, 30000);
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
    const showBadge = item.href === "/fishmb/messages" && unread > 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-label={showBadge ? `Messages, ${unread} unread` : item.label}
        className={`relative flex flex-col items-center justify-center gap-0.5 w-11 py-1.5 rounded-2xl transition-colors ${
          active ? "text-signal" : "text-pine/45 hover:text-pine"
        }`}
      >
        {item.icon}
        <span className="text-[9px] font-bold leading-none">{item.label}</span>
        {showBadge && (
          <span className="absolute top-0 right-0 min-w-5 h-5 px-1 rounded-full bg-signal text-white text-[10px] font-black flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        {active && <span className="absolute bottom-0 w-6 h-0.5 rounded-full bg-signal" />}
      </Link>
    );
  };

  return (
    <nav
      aria-label="FishMB sections"
      className="md:hidden fixed z-40 bottom-0 inset-x-0"
    >
      <div
        className="relative bg-white/95 backdrop-blur border-t border-pine/10 px-1 pt-1 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "calc(0.6rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-stretch">
          {LEFT.map((item) => (
            <div key={item.href} className="flex-1 flex justify-center">
              {renderItem(item)}
            </div>
          ))}
          <div className="flex-1 flex justify-center">
            {user && !user.is_anonymous ? (
              <Link
                href="/fishmb/feed?compose=1"
                aria-label="New post"
                className="-mt-8 w-14 h-14 rounded-full bg-signal hover:bg-signal-dark text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] border-4 border-white flex items-center justify-center transition-colors"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setPostGateOpen(true)}
                aria-label="New post"
                className="-mt-8 w-14 h-14 rounded-full bg-signal hover:bg-signal-dark text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] border-4 border-white flex items-center justify-center transition-colors"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
          </div>
          {RIGHT.map((item) => (
            <div key={item.href} className="flex-1 flex justify-center">
              {renderItem(item)}
            </div>
          ))}
        </div>
      </div>
      {/* Logged-out + tap: explain posting, then sign up */}
      {postGateOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-pine-deep/60" onClick={() => setPostGateOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 text-center max-h-[92vh] overflow-y-auto">
            <div className="text-5xl mb-3">🎣</div>
            <h2 className="text-xl font-black text-pine tracking-tight mb-2">
              This is where you post
            </h2>
            <p className="text-pine/65 text-sm mb-5">
              The <span className="font-bold text-pine">+</span> button is your
              way to share with the Manitoba fishing community — and to get
              your fish on the board in tournaments:
            </p>
            <div className="flex flex-col gap-3 text-left mb-6">
              {[
                ["🐟", "Log a catch", "Species, length, weight, photo and GPS — building your personal catch history."],
                ["📸", "Share a post", "Up to 4 photos or a 60-second video, with reactions and comments from other anglers."],
                ["🏆", "Submit tournament catches", "In a tournament? Your catch photos go straight to the live leaderboard with GPS and time stamps."],
              ].map(([icon, title, body]) => (
                <div key={title} className="flex items-start gap-3 bg-pine/5 rounded-2xl px-4 py-3">
                  <span className="text-2xl shrink-0">{icon}</span>
                  <span>
                    <span className="block text-sm font-black text-pine">{title}</span>
                    <span className="block text-xs text-pine/65 leading-snug mt-0.5">{body}</span>
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setPostGateOpen(false);
                openLogin();
              }}
              className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-8 py-4 rounded-full transition-colors mb-3"
            >
              Join free to start posting
            </button>
            <button
              onClick={() => setPostGateOpen(false)}
              className="text-pine/50 text-sm font-bold"
            >
              Maybe later
            </button>
            <p className="text-[11px] text-pine/40 mt-4">Anglers 13+ only.</p>
          </div>
        </div>
      )}
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
