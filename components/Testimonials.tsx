const TESTIMONIALS = [
  {
    quote:
      "Ordered the walleye crankbaits on a Tuesday, was catching eyes by the weekend. For the price I honestly expected less.",
    name: "Marc T.",
    detail: "Walleye angler, Lake Winnipeg",
  },
  {
    quote:
      "The 2-piece rod survived a full season in my truck and still feels great. You can't beat this value anywhere.",
    name: "Jen K.",
    detail: "Multi-species angler",
  },
  {
    quote:
      "Finally a tackle shop that lists every size with its own price. No guessing, no surprises at checkout.",
    name: "Dave R.",
    detail: "Pike & trout fisherman",
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5 text-ember-400" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="bg-night-900 border-y border-night-700">
      <div className="max-w-7xl mx-auto px-4 py-14">
        <p className="text-ember-400 text-xs font-bold uppercase tracking-[0.2em] mb-2 text-center">
          From the water
        </p>
        <h2 className="font-display font-bold uppercase text-3xl md:text-4xl text-white tracking-wide text-center mb-10">
          Anglers Talk
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="rounded-2xl bg-night-850 border border-night-700 p-6 flex flex-col"
            >
              <Stars />
              <blockquote className="text-slate-300 text-[15px] leading-relaxed mt-4 flex-1">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-5 pt-4 border-t border-night-700">
                <p className="font-semibold text-white text-sm">{t.name}</p>
                <p className="text-xs text-slate-500">{t.detail}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
