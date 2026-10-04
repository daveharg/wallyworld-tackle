"use client";

import Link from "next/link";
import { useCart } from "./CartContext";
import { CATEGORIES } from "../lib/categories";

export default function Header() {
  const { count } = useCart();

  return (
    <header className="site-header">
      <div className="header-top">
        <Link href="/" className="brand">
          <span className="brand-name">Wallyworld Tackle</span>
          <span className="tagline">good gear, low prices</span>
        </Link>
        <nav className="header-links">
          <Link href="/rods">Rods</Link>
          <Link href="/reels">Reels</Link>
          <Link href="/tackle">Tackle &amp; More</Link>
          <Link href="/cart" className="cart-link">
            Cart{count > 0 ? ` (${count})` : ""}
          </Link>
        </nav>
      </div>
      <nav className="category-nav" aria-label="Categories">
        <div className="category-nav-scroll">
          <Link href="/rods">Rods</Link>
          <Link href="/reels">Reels</Link>
          {CATEGORIES.filter((c) => c.key !== "rods" && c.key !== "reels").map((c) => (
            <Link key={c.key} href={c.href}>
              {c.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
