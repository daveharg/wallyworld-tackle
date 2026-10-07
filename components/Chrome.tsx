"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import CartDrawer from "./CartDrawer";

/**
 * Store chrome (header / footer / cart drawer) for the retail site.
 * The FishMB website lives under /fishmb and renders its own
 * FishMB-branded chrome instead, so it feels like a separate website.
 */
export default function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/fishmb")) {
    return <>{children}</>;
  }
  return (
    <>
      <Header />
      <main className="min-h-[70vh]">{children}</main>
      <Footer />
      <CartDrawer />
    </>
  );
}
