import Link from "next/link";

const TILES = [
  {
    label: "Rods",
    href: "/rods",
    img: "https://images.unsplash.com/photo-1499242611767-cf8b9be02854?auto=format&fit=crop&w=600&q=70",
    alt: "Fishing rods",
  },
  {
    label: "Reels",
    href: "/reels",
    img: "https://images.unsplash.com/photo-1445112098124-3e76dd67983c?auto=format&fit=crop&w=600&q=70",
    alt: "Angler with a spinning reel",
  },
  {
    label: "Hard Baits",
    href: "/tackle#hard-baits",
    img: "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=600&q=70",
    alt: "Hard baits at sunset",
  },
  {
    label: "Soft Plastics",
    href: "/tackle#soft-plastics",
    img: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=600&q=70",
    alt: "Misty lake morning",
  },
  {
    label: "Tackle Boxes",
    href: "/tackle#tackle-boxes",
    img: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=70",
    alt: "Gear packed for a fishing trip",
  },
  {
    label: "Tools",
    href: "/tackle#tools",
    img: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?auto=format&fit=crop&w=600&q=70",
    alt: "Fishing tools and accessories",
  },
];

/** Centered square image tiles, one per category. */
export default function ShopByCategory() {
  return (
    <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
      <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-pine tracking-wide text-center mb-8">
        Shop by Category
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
