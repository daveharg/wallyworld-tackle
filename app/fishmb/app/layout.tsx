import type { Metadata } from "next";

// The /fishmb/app page itself is a client component, so its SEO metadata
// lives here in the segment layout.
export const metadata: Metadata = {
  title: "Get the FishMB app — Manitoba fishing on your phone",
  description:
    "Open the free FishMB app: Manitoba fishing maps with your own spots, catch logging with auto-measure, tournaments, leaderboards, encrypted messages and a daily fish-activity forecast.",
  alternates: { canonical: "https://www.fishmb.ca/fishmb/app" },
  openGraph: {
    title: "Get the FishMB app — Manitoba fishing on your phone",
    description:
      "Open the free FishMB app: Manitoba fishing maps, catch logging, tournaments, leaderboards and a daily fish-activity forecast.",
    url: "https://www.fishmb.ca/fishmb/app",
  },
};

export default function AppSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
