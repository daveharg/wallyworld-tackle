import Link from "next/link";
import SearchHero from "./_components/SearchHero";
import HSlider, { SectionHeading } from "./_components/HSlider";
import { LakeCard, LodgeCard, HotLakeCard } from "./_components/Cards";
import {
  getHotLakes,
  getWalleyeLakes,
  getStockedLakes,
  getLodges,
  getZones,
  getLakes,
} from "@/lib/fishmb";
import { FISHMB_CTA_PHOTO } from "@/lib/fishmb-constants";

export const revalidate = 3600;

export default function FishMBHome() {
  const hot = getHotLakes();
  const walleye = getWalleyeLakes(12);
  const stocked = getStockedLakes(12);
  const lodges = getLodges().slice(0, 12);
  const zones = getZones();
  const lakeCount = getLakes().length;
  const lodgeCount = getLodges().length;

  return (
    <>
      <SearchHero />

      {/* Biting right now */}
      <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
        <SectionHeading
          eyebrow="Hot lakes"
          title="Biting right now"
          href="/fishmb/hot-lakes"
          linkLabel="All reports"
        />
        <HSlider>
          {hot.map((h, i) => (
            <HotLakeCard key={i} hot={h} />
          ))}
        </HSlider>
      </section>

      {/* Top walleye lakes */}
      <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
        <SectionHeading
          eyebrow="Walleye country"
          title="Top walleye lakes"
          href="/fishmb/lakes"
          linkLabel="All lakes"
        />
        <HSlider>
          {walleye.map((l) => (
            <LakeCard key={l.id} lake={l} />
          ))}
        </HSlider>
      </section>

      {/* Stocked waters */}
      <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
        <SectionHeading
          eyebrow="Put-and-take"
          title="Stocked waters"
          href="/fishmb/lakes"
          linkLabel="All lakes"
        />
        <HSlider>
          {stocked.map((l) => (
            <LakeCard key={l.id} lake={l} />
          ))}
        </HSlider>
      </section>

      {/* Regulations teaser */}
      <section className="bg-paper-deep border-y border-pine/10 mt-12 md:mt-16">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16">
          <SectionHeading
            eyebrow="2026 Anglers' Guide"
            title="Know the regs before you go"
            href="/fishmb/regulations"
            linkLabel="Full regulations"
          />
          <p className="text-pine/65 max-w-2xl -mt-3 mb-8">
            Possession limits, size restrictions and seasons for every Manitoba
            division — plus waterbody-specific rules on all {lakeCount} lake
            pages.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {zones.map((z) => (
              <Link
                key={z.id}
                href={`/fishmb/regulations#${z.id}`}
                className="bg-white rounded-2xl border border-pine/10 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <h3 className="font-display font-bold text-lg text-pine uppercase tracking-wide">
                  {z.name}
                </h3>
                <p className="text-sm text-pine/55 mt-1.5 line-clamp-3">
                  Limits, sizes &amp; seasons →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured lodges */}
      <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
        <SectionHeading
          eyebrow="Stay & fish"
          title="Lodges & guides"
          href="/fishmb/lodges"
          linkLabel="All lodges"
        />
        <HSlider>
          {lodges.map((l) => (
            <LodgeCard key={l.id} lodge={l} />
          ))}
        </HSlider>
      </section>

      {/* Stats band */}
      <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
        <div className="bg-pine rounded-3xl px-6 py-10 md:py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { n: String(lakeCount), label: "Lakes mapped" },
            { n: String(lodgeCount), label: "Lodges & guides" },
            { n: "4", label: "Regulation divisions" },
            { n: "Free", label: "The FishMB app" },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display font-bold text-4xl md:text-5xl text-gold">
                {s.n}
              </p>
              <p className="text-white/70 text-sm uppercase tracking-[0.18em] mt-1.5 font-bold">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* App CTA */}
      <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16 mb-4">
        <div className="relative overflow-hidden rounded-3xl bg-pine-deep">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FISHMB_CTA_PHOTO}
            alt="Fishing rods silhouetted over the water at sunset"
            className="absolute inset-0 w-full h-full object-cover opacity-40"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-pine-deep/90 to-pine-deep/30" />
          <div className="relative px-6 py-12 md:px-12 md:py-16 max-w-2xl">
            <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-3">
              Take it on the water
            </p>
            <h2 className="font-display font-bold uppercase text-white text-4xl md:text-5xl tracking-wide mb-4">
              The FishMB app
            </h2>
            <p className="text-white/80 text-lg mb-8">
              Every lake, regulation and lodge in your pocket — plus your catch
              log, the angler feed, and contests. Free, no sign-in required to
              browse.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/fish-manitoba-preview/"
                className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
              >
                Open the app
              </Link>
              <Link
                href="/fishmb/app"
                className="border border-white/40 text-white hover:bg-white/10 font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
              >
                Learn more
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
