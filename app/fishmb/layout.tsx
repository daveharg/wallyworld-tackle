import type { Metadata } from "next";
import FishHeader from "./_components/FishHeader";
import FishFooter from "./_components/FishFooter";
import { FishAuthProvider } from "./_components/FishAuth";

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
    <div className="min-h-screen bg-paper font-body text-pine">
      <FishAuthProvider>
        <FishHeader />
        <main className="min-h-[70vh]">{children}</main>
        <FishFooter />
      </FishAuthProvider>
    </div>
  );
}
