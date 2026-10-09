"use client";

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
];
export function FishChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = /\/tournaments\/[^/]+\/leaderboard/.test(pathname ?? "");
  const hideFooter =
    bare ||
    NO_FOOTER_PREFIXES.some((p) => (pathname ?? "").startsWith(p));
  // Top bar only on feed for phones; everywhere on desktop.
  const showHeader = (pathname ?? "").startsWith("/fishmb/feed");
  if (bare) return <>{children}</>;
  return (
    <div className="min-h-screen bg-paper font-body text-pine">
      <div className={showHeader ? "" : "hidden md:block"}>
        <FishHeader />
      </div>
      <main className="min-h-[70vh] pb-28 md:pb-32">{children}</main>
      {!hideFooter && <FishFooter />}
      <FishBottomBar />
    </div>
  );
}
