import type { Metadata, Viewport } from "next";
import { FishAuthProvider } from "./_components/FishAuth";
import { FishChrome } from "./_components/FishChrome";
import SWRegister from "./_components/SWRegister";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // When the iOS/Android keyboard opens, resize the layout instead of
  // overlaying it — keeps the chat message box pinned above the keyboard.
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: {
    // absolute: the root layout's "%s | Wallyworld Tackle" template would
    // otherwise wrap this default (templates apply to child-segment titles).
    absolute: "FishMB — Manitoba's fishing app: maps, catches, tournaments & community",
    template: "%s | FishMB",
  },
  description:
    "Your Manitoba fishing companion — predicting fish activity, interactive lake maps, log your catches, join tournaments, and connect with local anglers.",
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
    title: "FishMB — Manitoba's fishing app: maps, catches, tournaments & community",
    description:
      "Your Manitoba fishing companion — predicting fish activity, interactive lake maps, log your catches, join tournaments, and connect with local anglers.",
    url: "https://www.fishmb.ca/fishmb/feed",
    images: [
      {
        url: "https://www.fishmb.ca/fishmb/og-share.png",
        width: 1200,
        height: 630,
        alt: "FishMB — Manitoba fishing",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "FishMB — Manitoba's fishing app: maps, catches, tournaments & community",
    description:
      "Your Manitoba fishing companion — predicting fish activity, interactive lake maps, log your catches, join tournaments, and connect with local anglers.",
    images: ["https://www.fishmb.ca/fishmb/icon-512.png"],
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
