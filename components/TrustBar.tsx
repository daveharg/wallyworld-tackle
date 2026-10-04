const ITEMS = [
  {
    title: "Free Shipping $75+",
    text: "Fast, tracked delivery on qualifying orders",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 8h13v9H1zM14 11h4l3 3v3h-7z" />
        <circle cx="6" cy="19" r="1.8" />
        <circle cx="17" cy="19" r="1.8" />
      </svg>
    ),
  },
  {
    title: "Secure Checkout",
    text: "Encrypted payments powered by Shopify",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
  {
    title: "Quality Guarantee",
    text: "30-day hassle-free returns, no questions",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Chosen for Value",
    text: "Every product picked for performance per dollar",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12l4 6-10 13L2 9z" />
        <path d="M2 9h20M9 3l3 6 3-6M12 9l0 13" />
      </svg>
    ),
  },
];

export default function TrustBar() {
  return (
    <section className="border-y border-night-700 bg-night-900">
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
        {ITEMS.map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="shrink-0 grid place-items-center w-11 h-11 rounded-xl bg-ember-500/10 text-ember-400 border border-ember-500/20">
              {item.icon}
            </span>
            <div>
              <p className="font-display font-semibold uppercase tracking-wide text-sm text-white">
                {item.title}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
