import type { Metadata } from "next";
import { FishAuthProvider } from "./_components/FishAuth";
import { FishChrome } from "./_components/FishChrome";
import SWRegister from "./_components/SWRegister";

export const metadata: Metadata = {
  title: {
    default: "FishMB — Manitoba fishing lakes, lodges & regulations",
    template: "%s | FishMB",
  },
  description:
    "Search 271 Manitoba lakes and 127 lodges & guides. Look up 2026 fishing regulations, stocking history, and what's biting right now.",
  keywords: [
    "Manitoba fishing",
    "Manitoba lakes",
    "fishing regulations Manitoba",
    "walleye fishing Manitoba",
    "Manitoba fishing lodges",
    "ice fishing Manitoba",
    "FishMB",
  ],
  openGraph: {
    type: "website",
    siteName: "FishMB",
    title: "FishMB — Manitoba fishing lakes, lodges & regulations",
    description:
      "Search 271 Manitoba lakes and 127 lodges & guides. Look up 2026 fishing regulations, stocking history, and what's biting right now.",
    url: "https://www.wallyworldtackle.ca/fishmb",
    images: [
      {
        url: "https://www.wallyworldtackle.ca/fishmb/icon-512.png",
        width: 512,
        height: 512,
        alt: "FishMB — Manitoba fishing",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "FishMB — Manitoba fishing lakes, lodges & regulations",
    description:
      "Search 271 Manitoba lakes and 127 lodges & guides. Look up 2026 fishing regulations, stocking history, and what's biting right now.",
    images: ["https://www.wallyworldtackle.ca/fishmb/icon-512.png"],
  },
  manifest: "/fishmb/manifest.json",
  themeColor: "#1a2e1f",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FishMB",
  },
  icons: {
    icon: "/fishmb/icon-192.png",
    apple: "/fishmb/apple-touch-icon.png",
  },
};

export default function FishMBLayout({ children }: { children: React.ReactNode }) {
  return (
    <FishAuthProvider>
      <SWRegister />
      <FishChrome>{children}</FishChrome>
    </FishAuthProvider>
  );
}
