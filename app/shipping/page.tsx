import Link from "next/link";

export const metadata = {
  title: "Shipping Info — Wallyworld Tackle",
  description:
    "Free shipping across Canada on all orders. Learn about delivery times and how we keep prices low.",
};

export default function ShippingPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/" className="text-signal text-sm font-semibold hover:underline">
        ← Back home
      </Link>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mt-4 mb-8">
        Shipping Info
      </h1>

      <div className="space-y-8 text-pine/80">
        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-6">
          <h2 className="font-display font-bold text-2xl text-pine mb-3">
            Free Shipping Across Canada
          </h2>
          <p className="leading-relaxed">
            Every order ships free, anywhere in Canada. No minimum purchase, no codes, no
            catches — if you can add it to your cart, it ships free.
          </p>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-pine mb-3">Delivery Times</h2>
          <p className="leading-relaxed">
            Most items ship <strong>direct from our suppliers</strong>, which is how we keep
            prices so low. Please allow <strong>7–14 business days</strong> for delivery.
          </p>
          <p className="leading-relaxed mt-4">
            You'll receive tracking information by email once your order ships so you can
            follow it every step of the way.
          </p>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-pine mb-3">Where We Ship</h2>
          <p className="leading-relaxed">
            We currently ship to all Canadian provinces and territories:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Ontario, Quebec, British Columbia, Alberta</li>
            <li>Manitoba, Saskatchewan, Nova Scotia, New Brunswick</li>
            <li>Newfoundland and Labrador, Prince Edward Island</li>
            <li>Yukon, Northwest Territories, Nunavut</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-pine mb-3">How We Keep It Free</h2>
          <p className="leading-relaxed">
            By shipping direct from suppliers and keeping our overhead low, we can offer
            free shipping without inflating product prices. Good gear, low prices — that's
            the whole idea.
          </p>
        </div>

        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-6 mt-10">
          <p className="font-bold text-pine mb-2">Ready to shop?</p>
          <p className="text-pine/60 text-sm mb-4">
            Browse rods, reels, and tackle — all with free shipping.
          </p>
          <Link
            href="/rods"
            className="inline-block bg-signal text-white font-bold px-6 py-3 rounded-xl hover:bg-signal/90 transition-colors"
          >
            Shop Now
          </Link>
        </div>
      </div>
    </div>
  );
}
