import Link from "next/link";

const SHOP_LINKS = [
  { label: "Rods", href: "/rods" },
  { label: "Reels", href: "/reels" },
  { label: "Hard Baits", href: "/tackle#hard-baits" },
  { label: "Soft Plastics", href: "/tackle#soft-plastics" },
  { label: "Jig Heads", href: "/tackle#jig-heads" },
  { label: "Tackle Boxes", href: "/tackle#tackle-boxes" },
  { label: "Tools & Accessories", href: "/tackle#tools" },
  { label: "Walleye Picks", href: "/#walleye-picks" },
];

const SUPPORT_LINKS = [
  { label: "Shipping Info", href: "/#newsletter" },
  { label: "Returns", href: "/#newsletter" },
  { label: "The Playbook", href: "/#playbook" },
  { label: "FAQ", href: "/#playbook" },
  { label: "Contact Us", href: "#contact" },
];

const ABOUT_LINKS = [
  { label: "Our Story", href: "/#newsletter" },
  { label: "Dave's Picks", href: "/#daves-picks" },
  { label: "Reviews", href: "/#daves-picks" },
  { label: "Wallyworld Rewards", href: "/#newsletter" },
];

const UTILITY = [
  {
    title: "Free Shipping",
    sub: "On orders over $75",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h11v10H3zM14 10h4l4 4v3h-8z" />
        <circle cx="7" cy="17.5" r="1.8" />
        <circle cx="17" cy="17.5" r="1.8" />
      </svg>
    ),
  },
  {
    title: "Easy Returns",
    sub: "30-day hassle-free returns",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </svg>
    ),
  },
  {
    title: "Secure Checkout",
    sub: "Shopify-protected payments",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
  {
    title: "Real Support",
    sub: "Anglers answering emails",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#0b231f] text-paper mt-16 scroll-mt-28">
      {/* utility strip */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {UTILITY.map((u) => (
            <div key={u.title} className="flex items-center gap-3.5">
              <span className="text-gold shrink-0">{u.icon}</span>
              <span>
                <span className="block font-display font-bold uppercase tracking-wide">{u.title}</span>
                <span className="block text-white/55 text-sm">{u.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* link columns */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-signal text-white font-display font-bold text-lg">
              W
            </span>
            <span className="font-display font-bold text-xl uppercase tracking-wide">
              Wallyworld Tackle
            </span>
          </div>
          <p className="text-white/55 text-sm leading-relaxed mb-5">
            Good gear, low prices. Freshwater tackle chosen by real Canadian
            anglers — shipped direct from Winnipeg, MB.
          </p>
          <div className="flex gap-2">
            {["Visa", "MC", "Amex", "PayPal"].map((p) => (
              <span
                key={p}
                className="text-[11px] font-bold uppercase tracking-wider border border-white/20 rounded px-2 py-1 text-white/60"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        <nav aria-label="Shop">
          <h3 className="font-display font-bold uppercase tracking-widest text-sm text-gold mb-4">Shop</h3>
          <ul className="space-y-2.5">
            {SHOP_LINKS.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-white/65 hover:text-white text-sm transition">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Support">
          <h3 className="font-display font-bold uppercase tracking-widest text-sm text-gold mb-4">Support</h3>
          <ul className="space-y-2.5">
            {SUPPORT_LINKS.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-white/65 hover:text-white text-sm transition">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="About">
          <h3 className="font-display font-bold uppercase tracking-widest text-sm text-gold mb-4">About</h3>
          <ul className="space-y-2.5">
            {ABOUT_LINKS.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-white/65 hover:text-white text-sm transition">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* copyright */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-white/45">
          <span>© 2026 Wallyworld Tackle. Good gear, low prices.</span>
          <span className="flex gap-5">
            <Link href="/#playbook" className="hover:text-white transition">Privacy</Link>
            <Link href="/#playbook" className="hover:text-white transition">Terms</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
