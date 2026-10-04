import type { Metadata } from "next";
import { CartProvider } from "../components/CartContext";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wallyworld Tackle — good gear, low prices",
  description:
    "Freshwater fishing tackle: rods, reels, jigs, soft plastics, hard baits, tackle boxes and more. Good gear, low prices.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Header />
          <main className="page">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
