import type { Metadata } from "next";

// The weather page itself is a client component, so its SEO metadata lives
// here in the segment layout.
export const metadata: Metadata = {
  title: "Manitoba fishing weather — fish-activity forecast",
  description:
    "FishMB's Manitoba fish-activity forecast: pressure trend, wind, storm fronts and moon phase turned into a daily prediction of how active the fish will be, plus the morning weather report.",
  alternates: { canonical: "https://www.fishmb.ca/fishmb/weather" },
  openGraph: {
    title: "Manitoba fishing weather — fish-activity forecast | FishMB",
    description:
      "Pressure trend, wind, storm fronts and moon phase turned into a daily Manitoba fish-activity forecast.",
    url: "https://www.fishmb.ca/fishmb/weather",
  },
};

export default function WeatherSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
