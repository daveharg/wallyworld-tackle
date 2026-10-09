"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useFishAuth } from "./FishAuth";
import { fishFetch } from "./fishFetch";

type Item = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS = {
  feed: (
    <svg {...iconProps}>
      <path d="M4 5.5h16v13H4z" />
      <path d="M4 10h16M9 10v8.5" />
    </svg>
  ),
  inbox: (
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
  maps: (
    <svg {...iconProps}>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  ),
};

/** Actions in the + popup menu. */
const PLUS_ACTIONS = [
  { href: "/fishmb/feed?log=catch", icon: "🐟", label: "Log a catch" },
  { href: "/fishmb/feed?compose=1", icon: "📸", label: "Share a post" },
  { href: "/fishmb/dashboard", icon: "📊", label: "Dashboard" },
  { href: "/fishmb/tournaments", icon: "🏆", label: "Tournaments" },
];

const LEFT: Item[] = [
  {
    href: "/fishmb/feed",
    label: "Feed",
    icon: ICONS.feed,
    match: (p) => p === "/fishmb/feed" || p === "/fishmb",
  },
  {
    href: "/fishmb/messages",
    label: "Inbox",
    icon: ICONS.inbox,
    match: (p) => p.startsWith("/fishmb/messages"),
  },
];

const RIGHT: Item[] = [
  {
    href: "/fishmb/weather",
    label: "Weather",
    icon: ICONS.weather,
    match: (p) => p.startsWith("/fishmb/weather"),
  },
  {
    href: "/fishmb/maps",
    label: "Maps",
    icon: ICONS.maps,
    match: (p) => p.startsWith("/fishmb/maps") || p.startsWith("/fishmb/lakes"),
  },
];

/** Create button as a circle: white with FishMB brand-color offset layers. */
function PlusButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative w-[52px] h-[52px] shrink-0 active:scale-95 transition-transform"
    >
      <span className="absolute inset-0 translate-x-[3px] rounded-full bg-signal" />
      <span className="absolute inset-0 -translate-x-[3px] rounded-full bg-gold" />
      <span className="absolute inset-0 rounded-full bg-white shadow-lg flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.8" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
    </button>
  );
}

function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, openLogin } = useFishAuth();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [postGateOpen, setPostGateOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    let stop = false;
    async function check() {
      try {
        if (!user || stop) return;
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

  // Close the + menu on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, searchParams]);

  // Tournament full-screen leaderboard stays bare.
  if (pathname.startsWith("/fishmb/tournaments/") && pathname.endsWith("/leaderboard")) return null;

  const loggedIn = !!user && !user.is_anonymous;

  const onPlusTap = () => {
    if (loggedIn) setMenuOpen((o) => !o);
    else setPostGateOpen(true);
  };

  // Swipe down on the popup dismisses it.
  const onSheetTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const onSheetTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
    if (endY - touchStartY.current > 40) setMenuOpen(false);
    touchStartY.current = null;
  };

  const renderItem = (item: Item) => {
    const active = item.match(pathname);
    const showBadge = item.label === "Inbox" && unread > 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-label={showBadge ? `Inbox, ${unread} unread` : item.label}
        className={`relative flex flex-col items-center justify-center gap-1 w-14 py-1 transition-colors ${
          active ? "text-signal" : "text-pine/45 hover:text-pine"
        }`}
      >
        {item.icon}
        <span className="text-[10px] font-medium leading-none">{item.label}</span>
        {showBadge && (
          <span className="absolute top-0 right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav aria-label="FishMB sections" className="md:hidden fixed z-40 bottom-0 inset-x-0">
      {/* + popup menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div
            ref={sheetRef}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onSheetTouchStart}
            onTouchEnd={onSheetTouchEnd}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 w-64 bg-white rounded-3xl shadow-2xl border border-pine/10 overflow-hidden"
          >
            <div className="w-10 h-1 rounded-full bg-pine/20 mx-auto mt-2.5" />
            <div className="p-2">
              {PLUS_ACTIONS.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-pine/5 active:bg-pine/10 transition-colors"
                >
                  <span className="text-2xl">{a.icon}</span>
                  <span className="text-sm font-bold text-pine">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        className="relative bg-white/95 backdrop-blur border-t border-pine/10 px-2 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "calc(1.1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center">
          {LEFT.map((item) => (
            <div key={item.href} className="flex-1 flex justify-center">
              {renderItem(item)}
            </div>
          ))}
          <div className="flex-1 flex justify-center">
            <PlusButton onClick={onPlusTap} label="Create" />
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
