import type { Metadata } from "next";
import { FishAuthProvider } from "./_components/FishAuth";
import { FishChrome } from "./_components/FishChrome";

export const metadata: Metadata = {
  title: {
    default: "FishMB — Manitoba fishing lakes, lodges & regulations",
    template: "%s | FishMB",
  },
  description:
    "Search 271 Manitoba lakes and 127 lodges & guides. Look up 2026 fishing regulations, stocking history, and what's biting right now.",
};

export default function FishMBLayout({ children }: { children: React.ReactNode }) {
  return (
    <FishAuthProvider>
      <FishChrome>{children}</FishChrome>
    </FishAuthProvider>
  );
}
