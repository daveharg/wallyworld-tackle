import type { Metadata } from "next";

// The contact page itself is a client component, so its SEO metadata lives
// here in the segment layout.
export const metadata: Metadata = {
  title: "Contact FishMB",
  description:
    "Contact the FishMB team — report a bug, flag a wrong regulation, suggest a lake or lodge, or ask about advertising and partnerships.",
  alternates: { canonical: "https://www.fishmb.ca/fishmb/contact" },
};

export default function ContactSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
