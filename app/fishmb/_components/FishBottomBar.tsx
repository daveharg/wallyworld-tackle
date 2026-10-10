"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
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
const ACTION_ICON_PROPS = {
  width: 30,
  height: 30,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "#12322b",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ACTION_ICONS = {
  catch: (
    <svg {...ACTION_ICON_PROPS}>
      <path d="M5.5 12c2.6-3.8 6.2-5.7 10.3-5.7 3 0 5.4 2.4 6 5.7-.6 3.3-3 5.7-6 5.7-4.1 0-7.7-1.9-10.3-5.7Z" />
      <path d="M5.5 12 2.5 9.2v5.6L5.5 12Z" />
      <circle cx="16.8" cy="11" r="0.9" fill="#12322b" stroke="none" />
    </svg>
  ),
  post: (
    <svg {...ACTION_ICON_PROPS}>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
      <path d="M8.5 7.5 10 5h4l1.5 2.5" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  ),
  dashboard: (
    <svg {...ACTION_ICON_PROPS}>
      <path d="M4 4v16h16" />
      <path d="M8.5 16v-4.5M13 16V8M17.5 16v-2.5" />
    </svg>
  ),
  trophy: (
    <svg {...ACTION_ICON_PROPS}>
      <path d="M8 4h8v4.5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.5H5a3.5 3.5 0 0 0 3.7 3.5M16 5.5h3a3.5 3.5 0 0 1-3.7 3.5" />
      <path d="M12 12.5v3M8.8 20h6.4M10 15.5h4" />
    </svg>
  ),
};

const PLUS_ACTIONS = [
  { href: "/fishmb/feed?log=catch", icon: ACTION_ICONS.catch, label: "Log a catch" },
  { href: "/fishmb/feed?compose=1", icon: ACTION_ICONS.post, label: "Share a post" },
  { href: "/fishmb/dashboard", icon: ACTION_ICONS.dashboard, label: "Angler HQ" },
  { href: "/fishmb/dashboard?tab=tournaments", icon: ACTION_ICONS.trophy, label: "Tournaments" },
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

/** Center + button: dark circle like the reference design (X while the menu is open). */
function PlusButton({ onClick, label, open }: { onClick: () => void; label: string; open: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-[54px] h-[54px] shrink-0 rounded-full bg-pine-deep text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
    >
      {open ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      ) : (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
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
  // Which tab was just tapped — highlights instantly while the page loads.
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Once navigation lands, the pathname drives the highlight again.
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

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

  // Swipe down / tap-away handled by the overlay click; the X button also closes.

  const renderItem = (item: Item) => {
    // Highlight instantly on tap — don't wait for the new page to finish loading.
    const active = pendingHref ? item.href === pendingHref : item.match(pathname);
    const showBadge = item.label === "Inbox" && unread > 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setPendingHref(item.href)}
        aria-label={showBadge ? `Inbox, ${unread} unread` : item.label}
        className={`relative flex flex-col items-center justify-center gap-1 w-16 py-2 rounded-full transition-colors ${
          active ? "text-pine bg-pine/[0.07]" : "text-pine/45 hover:text-pine"
        }`}
      >
        {item.icon}
        <span className={`text-[10px] leading-none ${active ? "font-bold" : "font-medium"}`}>{item.label}</span>
        {showBadge && (
          <span className="absolute top-0 right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav
      aria-label="FishMB sections"
      className={`fixed bottom-0 inset-x-0 flex justify-center pointer-events-none ${
        menuOpen ? "z-[1100]" : "z-40"
      }`}
    >
      <style>{`@keyframes fmb-rise { from { opacity: 0; transform: translateY(14px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
      {/* + menu: shade out the background, circular action buttons stacked
          from just above the bar, circles centred on the + button */}
      {menuOpen && (
        <div
          className="fixed inset-0 pointer-events-auto bg-pine-deep/70 backdrop-blur-[2px]"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-32 flex flex-col items-center gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {PLUS_ACTIONS.map((a, i) => (
              <Link
                key={a.href}
                href={a.href}
                onClick={() => setMenuOpen(false)}
                className="relative flex justify-center"
                style={{ animation: "fmb-rise 0.25s ease-out both", animationDelay: `${i * 60}ms` }}
              >
                <span className="w-16 h-16 shrink-0 rounded-full bg-white shadow-2xl flex items-center justify-center">
                  {a.icon}
                </span>
                <span className="absolute left-[calc(50%+2.75rem)] top-1/2 -translate-y-1/2 whitespace-nowrap text-white text-2xl font-bold tracking-tight">
                  {a.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Floating pill bar, raised off the bottom of the phone */}
      <div
        className="pointer-events-auto w-full mx-4 mb-5 md:mx-0 md:mb-6 md:w-[38rem] md:max-w-[calc(100vw-2rem)] relative bg-white rounded-full px-3 shadow-[0_10px_36px_rgba(0,0,0,0.16)] border border-pine/10"
        style={{
          paddingTop: "0.55rem",
          paddingBottom: "calc(0.55rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-center">
          {LEFT.map((item) => (
            <div key={item.href} className="flex-1 flex justify-center">
              {renderItem(item)}
            </div>
          ))}
          <div className="flex-1 flex justify-center">
            <PlusButton onClick={onPlusTap} label={menuOpen ? "Close menu" : "Create"} open={menuOpen} />
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-auto">
          <div className="absolute inset-0 bg-pine-deep/60" onClick={() => setPostGateOpen(false)} />
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 text-center max-h-[92vh] overflow-y-auto">
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
 ["", "Log a catch", "Species, length, weight, photo and GPS — building your personal catch history."],
 ["", "Share a post", "Up to 4 photos or a 60-second video, with reactions and comments from other anglers."],
 ["", "Submit tournament catches", "In a tournament? Your catch photos go straight to the live leaderboard with GPS and time stamps."],
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
