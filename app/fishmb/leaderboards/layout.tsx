import type { Metadata } from "next";

// The leaderboards page itself is a client component, so its SEO metadata
// lives here in the segment layout.
export const metadata: Metadata = {
  title: "Manitoba fishing leaderboards — biggest fish & top anglers",
  description:
    "FishMB provincial leaderboards: the biggest fish, top anglers and Master Angler counts across Manitoba, species by species.",
  alternates: { canonical: "https://www.fishmb.ca/fishmb/leaderboards" },
  openGraph: {
    title: "Manitoba fishing leaderboards — biggest fish & top anglers | FishMB",
    description:
      "The biggest fish, top anglers and Master Angler counts across Manitoba, species by species.",
    url: "https://www.fishmb.ca/fishmb/leaderboards",
  },
};

export default function LeaderboardsSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
