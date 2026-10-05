import type { Metadata } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import { CartProvider } from "../components/CartContext";
import AuthProviders from "../components/AuthProviders";
import Header from "../components/Header";
import Footer from "../components/Footer";
import CartDrawer from "../components/CartDrawer";
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
    "cheap fishing tackle Canada",
  ],
  openGraph: {
    type: "website",
    siteName: "Wallyworld Tackle",
    title: "Wallyworld Tackle — good gear, low prices",
    description:
      "Rods, reels and tackle chosen for performance per dollar. Free shipping. Good gear, low prices.",
    url: "https://www.wallyworldtackle.ca",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wallyworld Tackle — good gear, low prices",
    description:
      "Rods, reels and tackle chosen for performance per dollar. Free shipping.",
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
            <Header />
            <main className="min-h-[70vh]">{children}</main>
            <Footer />
            <CartDrawer />
          </CartProvider>
        </AuthProviders>
      </body>
    </html>
  );
}
