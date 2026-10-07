"use client";

import { usePathname } from "next/navigation";
import FishHeader from "./FishHeader";
import FishFooter from "./FishFooter";

/** Site chrome — skipped on full-screen display routes like the leaderboard board. */
export function FishChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = /\/tournaments\/[^/]+\/leaderboard/.test(pathname ?? "");
  if (bare) return <>{children}</>;
  return (
    <div className="min-h-screen bg-paper font-body text-pine">
      <FishHeader />
      <main className="min-h-[70vh]">{children}</main>
      <FishFooter />
    </div>
  );
}
