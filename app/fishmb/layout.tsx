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
