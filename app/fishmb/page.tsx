import Link from "next/link";
import SearchHero from "./_components/SearchHero";
import HSlider, { SectionHeading } from "./_components/HSlider";
import { LakeCard, LodgeCard, HotLakeCard } from "./_components/Cards";
import { LoginCtaSection } from "./_components/LoginCta";
import {
  getHotLakes,
  getWalleyeLakes,
  getStockedLakes,
  getLodges,
  getZones,
  getLakes,
  getYoutubeShows,
  getTournaments,
} from "@/lib/fishmb";
import { FISHMB_CTA_PHOTO } from "@/lib/fishmb-constants";

export const revalidate = 3600;

const GUIDE_URL =
  "https://www.gov.mb.ca/nrnd/fish-wildlife/pubs/fish_wildlife/fish/angling-guide.pdf";

export default function FishMBHome() {
  const hot = getHotLakes();
  const walleye = getWalleyeLakes(12);
  const stocked = getStockedLakes(12);
  const lodges = getLodges().slice(0, 12);
  const zones = getZones();
  const shows = getYoutubeShows();
  const { tournaments, updated: tourneyUpdated } = getTournaments();
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

      {/* Top lodges & guides */}
      <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
        <SectionHeading
          eyebrow="Stay & fish"
          title="Top lodges & guides"
          href="/fishmb/lodges"
          linkLabel="All lodges"
        />
        <HSlider>
          {lodges.map((l) => (
            <LodgeCard key={l.id} lodge={l} />
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

      {/* Fishing licence */}
      <section className="bg-pine mt-12 md:mt-16">
        <div className="max-w-7xl mx-auto px-4 py-12 md:py-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-3">
              Before you cast
            </p>
            <h2 className="font-display font-bold uppercase text-white text-3xl md:text-4xl tracking-wide mb-4">
              Get your Manitoba fishing licence
            </h2>
            <p className="text-white/80 mb-4">
              Almost everyone fishing in Manitoba needs a provincial angling
              licence. The easiest way is online through the province&apos;s
              e-licensing system — you just need an email address to create an
              account. A Manitoba resident annual licence is $29.40 (one-day
              $13.65); Canadian resident annual $45.15; non-Canadian resident
              annual $72.45. Fees effective April 1, 2026.
            </p>
            <p className="text-white/80 mb-8">
              You can also buy in person at participating vendors, or by phone
              at 1-877-880-1203.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.manitobaelicensing.ca"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
              >
                Buy your licence
              </a>
              <a
                href="https://www.gov.mb.ca/elicensing/fees.html"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-white/40 text-white hover:bg-white/10 font-bold uppercase tracking-wider text-sm px-7 py-3.5 rounded-full transition-colors"
              >
                Licence fees
              </a>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl min-h-[280px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={FISHMB_CTA_PHOTO}
              alt="Fishing rods silhouetted over the water at sunset"
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-pine-deep/70 to-transparent" />
            <div className="absolute bottom-0 p-6">
              <p className="text-white/90 text-sm">
                Keep your licence on you while fishing, and check the{" "}
                <a
                  href={GUIDE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-bold"
                >
                  2026 Manitoba Anglers&apos; Guide
                </a>{" "}
                for the rules on the water you&apos;re fishing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Regulations teaser */}
      <section className="bg-paper-deep border-b border-pine/10">
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

      {/* Manitoba YouTubers */}
      <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
        <SectionHeading
          eyebrow="Watch & learn"
          title="Top Manitoba fishing YouTubers"
        />
        <HSlider>
          {shows.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="snap-start shrink-0 w-72 md:w-80 bg-pine-deep rounded-2xl p-6 flex flex-col hover:-translate-y-1 hover:shadow-xl transition-all group"
            >
              <span className="w-12 h-12 rounded-full bg-signal flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <h3 className="font-display font-bold text-white text-xl uppercase tracking-wide mb-2">
                {s.name}
              </h3>
              <p className="text-white/65 text-sm line-clamp-4 flex-1">
                {s.description}
              </p>
              <span className="text-gold text-sm font-bold uppercase tracking-wider mt-4">
                Watch →
              </span>
            </a>
          ))}
        </HSlider>
      </section>

      {/* Upcoming tournaments */}
      {tournaments.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
          <SectionHeading
            eyebrow="Compete"
            title="Upcoming Manitoba tournaments"
          />
          <p className="-mt-3 mb-6 text-sm text-pine/55">
            Researched {tourneyUpdated ? `on ${tourneyUpdated}` : "recently"} —
            always confirm dates and entry details with the organizer.
          </p>
          <HSlider>
            {tournaments.map((t) => (
              <a
                key={t.name}
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="snap-start shrink-0 w-72 md:w-80 bg-white border border-pine/10 rounded-2xl p-6 flex flex-col hover:-translate-y-1 hover:shadow-xl transition-all"
              >
                <p className="text-signal font-bold uppercase tracking-[0.2em] text-xs mb-2">
                  {t.dates}
                </p>
                <h3 className="font-display font-bold text-pine text-xl uppercase tracking-wide mb-1">
                  {t.name}
                </h3>
                <p className="text-pine/55 text-sm font-bold mb-3">{t.location}</p>
                <p className="text-pine/70 text-sm line-clamp-4 flex-1">
                  {t.description}
                </p>
                {t.entry && (
                  <p className="text-pine/55 text-sm mt-3">Entry: {t.entry}</p>
                )}
                <span className="text-signal-dark text-sm font-bold uppercase tracking-wider mt-4">
                  Details →
                </span>
              </a>
            ))}
          </HSlider>
        </section>
      )}

      {/* Stats band */}
      <section className="max-w-7xl mx-auto px-4 mt-12 md:mt-16">
        <div className="bg-pine rounded-3xl px-6 py-10 md:py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { n: String(lakeCount), label: "Lakes mapped" },
            { n: String(lodgeCount), label: "Lodges & guides" },
            { n: "4", label: "Regulation divisions" },
            { n: String(shows.length), label: "MB YouTube channels" },
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

      {/* Login CTA */}
      <LoginCtaSection />
    </>
  );
}
