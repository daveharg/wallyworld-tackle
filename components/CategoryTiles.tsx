import Link from "next/link";

const TILES = [
  {
    title: "Shop Rods",
    blurb: "Two-piece, telescopic & casting — every budget covered.",
    href: "/rods",
    img: "https://images.unsplash.com/photo-1499242611767-cf8b9be02854?auto=format&fit=crop&w=1200&q=70",
    alt: "Angler holding a fishing rod on a river",
  },
  {
    title: "Shop Reels",
    blurb: "Spinning reels in every size, smooth drags, honest prices.",
    href: "/reels",
    img: "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=1200&q=70",
    alt: "Fishing at sunset on a calm lake",
  },
];

/** Two large lifestyle category cards. */
export default function CategoryTiles() {
  return (
    <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
      <div className="grid md:grid-cols-2 gap-4 md:gap-5">
        {TILES.map((t) => (
          <Link
            key={t.title}
            href={t.href}
            className="group relative rounded-2xl overflow-hidden h-72 md:h-[380px] bg-pine-deep block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.img}
              alt={t.alt}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-[1.03] transition duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-pine-deep/90 via-pine-deep/25 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-7 md:p-9">
              <h3 className="font-display font-bold uppercase text-3xl md:text-4xl text-white tracking-wide mb-1.5">
                {t.title}
              </h3>
              <p className="text-white/75 text-sm md:text-base mb-4 max-w-sm">{t.blurb}</p>
              <span className="inline-flex items-center gap-2 text-white font-display font-bold uppercase tracking-widest text-sm group-hover:gap-3.5 transition-all">
                Shop now
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
