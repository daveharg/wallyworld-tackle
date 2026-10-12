"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import FishHeader from "./FishHeader";
import FishFooter from "./FishFooter";
import FishBottomBar from "./FishBottomBar";

/** Site chrome — skipped on full-screen display routes like the leaderboard board. */
/** The big footer is hidden on bottom-bar tab pages (app-style screens). */
const NO_FOOTER_PREFIXES = [
  "/fishmb/feed",
  "/fishmb/dashboard",
  "/fishmb/profile",
  "/fishmb/maps",
  "/fishmb/lakes",
  "/fishmb/weather",
  "/fishmb/messages",
  "/fishmb/friends",
  "/fishmb/leaderboards",
  "/fishmb/tournaments",
  "/fishmb/catches",
  "/fishmb/anglers",
];
export function FishChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = /\/tournaments\/[^/]+\/leaderboard/.test(pathname ?? "");
  const hideFooter =
    bare ||
    NO_FOOTER_PREFIXES.some((p) => (pathname ?? "").startsWith(p));
  const mainRef = useRef<HTMLElement | null>(null);
  const positions = useRef(new Map<string, number>());
  const popped = useRef(false);

  // App shell (the permanent bottom-bar fix): the document itself never
  // scrolls — <main> is the only scroller and the bottom bar is a plain
  // layout row under it, NOT a position:fixed overlay. A fixed bar on iOS
  // is anchored to the visual viewport, so it rides up and down with the
  // toolbar animation, the rubber-band bounce and the keyboard no matter
  // how it's patched (it broke that way repeatedly). A bar in normal
  // flow has no viewport math at all — it cannot move.
  // Scroll positions are remembered per page so Back restores your
  // place, like the document scroll used to.
  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || !pathname) return;
    el.scrollTop = popped.current ? (positions.current.get(pathname) ?? 0) : 0;
    popped.current = false;
  }, [pathname]);

  // The old top bar is hidden on mobile everywhere — the feed has its own
  // mobile header now. Desktop keeps it.
  if (bare) return <>{children}</>;
  return (
    <div className="fishmb-shell h-dvh flex flex-col overflow-hidden bg-paper font-body text-pine">
      <div className="hidden md:block shrink-0">
        <FishHeader />
      </div>
      <main
        ref={mainRef}
        data-fishmb-scroll
        onScroll={(e) => {
          if (pathname) positions.current.set(pathname, e.currentTarget.scrollTop);
        }}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col"
      >
        <div className="flex-1 pb-6 md:pb-10">{children}</div>
        {!hideFooter && <FishFooter />}
      </main>
      <FishBottomBar />
    </div>
  );
}
