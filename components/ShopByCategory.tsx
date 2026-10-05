import Link from "next/link";

const TILES = [
  {
    label: "Rods",
    href: "/rods",
    img: "https://images.unsplash.com/photo-1541742425281-c1d3fc8aff96?auto=format&fit=crop&w=600&q=70",
    alt: "Fishing rod at sunset",
  },
  {
    label: "Reels",
    href: "/reels",
    img: "https://images.unsplash.com/photo-1609859682240-6860cf3d99d5?auto=format&fit=crop&w=600&q=70",
    alt: "Anglers fishing on a lake",
  },
  {
    label: "Hard Baits",
    href: "/tackle#hard-baits",
    img: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=600&q=70",
    alt: "Calm lake with a wooden dock",
  },
  {
    label: "Soft Plastics",
    href: "/tackle#soft-plastics",
    img: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=600&q=70",
    alt: "Boat on a mountain lake",
  },
  {
    label: "Tackle Boxes",
    href: "/tackle#tackle-boxes",
    img: "https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=600&q=70",
    alt: "Wooden dock on a calm lake",
  },
  {
    label: "Ice Fishing",
    href: "/ice-fishing",
    img: "/hero/ice-fishing-hero.jpg",
    alt: "Blue ice fishing tent on a frozen lake",
  },
  {
    label: "Tools",
    href: "/tackle#tools",
    img: "https://images.unsplash.com/photo-1609859682240-6860cf3d99d5?auto=format&fit=crop&w=600&q=70",
    alt: "Anglers fishing on a lake",
  },
];

/** Centered square image tiles, one per category. */
export default function ShopByCategory() {
  return (
    <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
      <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide text-center mb-8">
        Shop by Category
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        {TILES.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="group relative rounded-xl overflow-hidden aspect-square bg-pine-deep block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t.img}
              alt={t.alt}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-pine-deep/85 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3.5">
              <span className="font-display font-bold uppercase text-lg text-white tracking-wide">
                {t.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
