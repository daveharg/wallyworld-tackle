"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useFishAuth } from "./FishAuth";
import { fishFetch } from "./fishFetch";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round">
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </svg>
  );
}

function MapIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" />
    </svg>
  );
}

/**
 * Mobile bottom nav — on every FishMB page. Feed, Dashboard, big post
 * button in the middle, Maps, Messages (with unread badge).
 */
export default function FishBottomBar() {
  const pathname = usePathname();
  const { user } = useFishAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let live = true;
    const check = async () => {
      try {
        const d = await fishFetch("/api/fishmb/msg/unread");
        if (live) setUnread(Number((d as { unread: number }).unread) || 0);
      } catch {
        // badge stays as-is
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [user, pathname]);

  const isFeed = pathname === "/fishmb" || pathname?.startsWith("/fishmb/feed");
  const isDashboard = pathname?.startsWith("/fishmb/dashboard");
  const isMaps = pathname?.startsWith("/fishmb/lakes");
  const isMessages = pathname?.startsWith("/fishmb/messages");

  const item = (active: boolean) =>
    `flex flex-col items-center gap-1 flex-1 py-1 transition-colors ${
      active ? "text-signal" : "text-white/55 hover:text-white"
    }`;
  const label = "text-[10px] font-bold uppercase tracking-wider";

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 pointer-events-none"
    >
      <div className="mx-3 mb-3 pointer-events-auto">
        <div
          className="relative bg-pine-deep/95 backdrop-blur border border-white/10 rounded-[28px] shadow-2xl px-2 pt-2 flex items-end justify-around"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <Link href="/fishmb/feed" className={item(!!isFeed)} aria-label="Feed">
            <HomeIcon active={!!isFeed} />
            <span className={label}>Feed</span>
          </Link>
          <Link
            href="/fishmb/dashboard"
            className={item(!!isDashboard)}
            aria-label="Dashboard"
          >
            <DashboardIcon active={!!isDashboard} />
            <span className={label}>Dashboard</span>
          </Link>

          {/* Post circle */}
          <Link
            href="/fishmb/feed?compose=1"
            aria-label="Post"
            className="flex flex-col items-center flex-1 -mt-8"
          >
            <span className="w-16 h-16 rounded-full bg-signal hover:bg-signal-dark text-white flex items-center justify-center shadow-xl border-4 border-paper transition-colors">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className={`${label} text-white/55 mt-1`}>Post</span>
          </Link>

          <Link
            href="/fishmb/lakes"
            className={item(!!isMaps)}
            aria-label="Maps"
          >
            <MapIcon active={!!isMaps} />
            <span className={label}>Maps</span>
          </Link>
          <Link
            href="/fishmb/messages"
            className={`${item(!!isMessages)} relative`}
            aria-label="Messages"
          >
            <span className="relative">
              <ChatIcon active={!!isMessages} />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-signal text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </span>
            <span className={label}>Messages</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
