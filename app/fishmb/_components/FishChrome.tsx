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
];
export function FishChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = /\/tournaments\/[^/]+\/leaderboard/.test(pathname ?? "");
  const hideFooter =
    bare ||
    NO_FOOTER_PREFIXES.some((p) => (pathname ?? "").startsWith(p));
  if (bare) return <>{children}</>;
  return (
    <div className="min-h-screen bg-paper font-body text-pine">
      <FishHeader />
      <main className="min-h-[70vh] pb-24 md:pb-0">{children}</main>
      {!hideFooter && <FishFooter />}
      <FishBottomBar />
    </div>
  );
}
