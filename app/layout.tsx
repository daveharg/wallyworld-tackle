import type { Metadata } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import { CartProvider } from "../components/CartContext";
import AuthProviders from "../components/AuthProviders";
import Chrome from "../components/Chrome";
import ScrollToTop from "../components/ScrollToTop";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Wallyworld Tackle — good gear, low prices",
    template: "%s | Wallyworld Tackle",
  },
  verification: {
    google: "5fEkkNP8ESb6REMIPAImMACavGL2TDzh2z0hlOsm3LA",
  },
  description:
    "Freshwater fishing tackle: rods, reels, jigs, soft plastics, hard baits, tackle boxes and more. Chosen by Canadian anglers. Good gear, low prices. Free shipping.",
  keywords: [
    "fishing tackle",
    "fishing rods",
    "fishing reels",
    "walleye fishing",
    "fishing lures",
    "jig heads",
    "soft plastics",
    "tackle boxes",
    "Canada fishing gear",
    "budget fishing tackle Canada",
  ],
  openGraph: {
    type: "website",
    siteName: "Wallyworld Tackle",
    title: "Wallyworld Tackle — good gear, low prices",
    description:
      "Rods, reels and tackle chosen for performance per dollar. Free shipping. Good gear, low prices.",
    url: "https://www.wallyworldtackle.ca",
    images: [
      {
        url: "https://www.wallyworldtackle.ca/og-image.png",
        width: 1200,
        height: 630,
        alt: "Wallyworld Tackle — good gear, low prices",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wallyworld Tackle — good gear, low prices",
    description:
      "Rods, reels and tackle chosen for performance per dollar. Free shipping.",
    images: ["https://www.wallyworldtackle.ca/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <AuthProviders>
          <CartProvider>
            <ScrollToTop />
            <Chrome>{children}</Chrome>
          </CartProvider>
        </AuthProviders>
      </body>
    </html>
  );
}
