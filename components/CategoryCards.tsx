import Link from "next/link";

const CARDS = [
  {
    label: "Rods",
    href: "/rods",
    blurb: "Spinning & casting, 2-pc value to carbon",
    img: "https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=70",
  },
  {
    label: "Reels",
    href: "/reels",
    blurb: "Smooth drags from 1000 to 5000 series",
    img: "https://images.unsplash.com/photo-1499242611767-cf8b9be02854?auto=format&fit=crop&w=800&q=70",
  },
  {
    label: "Hard Baits",
    href: "/tackle#hard-baits",
    blurb: "Crankbaits, spinnerbaits & topwater",
    img: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?auto=format&fit=crop&w=800&q=70",
  },
  {
    label: "Soft Plastics",
    href: "/tackle#soft-plastics",
    blurb: "Grubs, worms & swimbaits that get bit",
    img: "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&w=800&q=70",
  },
  {
    label: "Tackle Boxes",
    href: "/tackle#tackle-boxes",
    blurb: "Waterproof storage in S / M / L",
    img: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=70",
  },
  {
    label: "Tools & Accessories",
    href: "/tackle#tools",
    blurb: "Pliers, nets, knives & more",
    img: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=70",
  },
];

export default function CategoryCards() {
  return (
    <section className="max-w-7xl mx-auto px-4 py-14">
      <div className="flex items-end justify-between mb-7">
        <div>
          <p className="text-ember-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">
            Shop by category
          </p>
          <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-white tracking-wide">
            Find Your Edge
          </h2>
        </div>
        <Link href="/tackle" className="hidden sm:inline text-sm font-semibold text-ember-400 hover:text-ember-500">
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {CARDS.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="group relative rounded-2xl overflow-hidden border border-night-700 hover:border-ember-500/60 transition min-h-[170px] md:min-h-[210px] flex"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.img}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-65 group-hover:scale-105 transition duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/55 to-night-950/10" />
            <div className="relative mt-auto p-4 md:p-5">
              <h3 className="font-display font-bold uppercase tracking-wide text-lg md:text-2xl text-white group-hover:text-ember-400 transition-colors">
                {c.label}
              </h3>
              <p className="text-xs md:text-sm text-slate-300 mt-1">{c.blurb}</p>
              <span className="inline-block mt-2 text-xs font-bold uppercase tracking-widest text-ember-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                Shop now →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
