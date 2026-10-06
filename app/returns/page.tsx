import Link from "next/link";

export const metadata = {
  title: "Returns & Refunds — Wallyworld Tackle",
  description:
    "Our return policy: 15 days from delivery, unused items in original packaging. Wrong or defective items made right.",
};

export default function ReturnsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link href="/" className="text-signal text-sm font-semibold hover:underline">
        ← Back home
      </Link>
      <h1 className="font-display font-bold uppercase text-4xl md:text-5xl text-pine tracking-wide mt-4 mb-8">
        Returns & Refunds
      </h1>

      <div className="space-y-8 text-pine/80">
        <div className="rounded-2xl bg-paper-deep border border-pine/10 p-6">
          <h2 className="font-display font-bold text-2xl text-pine mb-3">
            Changed Your Mind?
          </h2>
          <p className="leading-relaxed">
            You have <strong>15 days from delivery</strong> to send an item back.
            Items must be <strong>unused and in their original packaging</strong>.
          </p>
          <p className="leading-relaxed mt-4">
            Because our gear ships direct from our suppliers, returns go back to
            the supplier — <strong>you cover the return shipping</strong>. If a
            return is needed, contact us first and we&apos;ll give you the
            address to send it to. Once the supplier confirms they&apos;ve
            received it, we&apos;ll refund the item price.
          </p>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-pine mb-3">
            Wrong or Defective Item?
          </h2>
          <p className="leading-relaxed">
            That&apos;s on us to make right. Send us a photo showing the problem
            and we&apos;ll sort it out with a <strong>refund or replacement</strong>.
            If the supplier needs the item back, we&apos;ll give you their
            return address — return shipping is at your cost.
          </p>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-pine mb-3">
            How Refunds Work
          </h2>
          <p className="leading-relaxed">
            Refunds go back to your <strong>original payment method</strong>.
            How quickly it lands depends on your bank or card issuer — usually
            within a few business days of us issuing it.
          </p>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-pine mb-3">
            Start a Return
          </h2>
          <p className="leading-relaxed">
            To start a return or report a problem with your order,{" "}
            <a href="#contact" className="text-signal font-semibold hover:underline">
              contact us
            </a>{" "}
            with your order number and a photo of the item if it&apos;s
            defective or wrong. We&apos;ll take it from there.
          </p>
        </div>
      </div>
    </div>
  );
}
