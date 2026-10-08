import Link from "next/link";
import { Wordmark } from "./FishHeader";

export default function FishFooter() {
  return (
    <footer className="bg-pine-deep text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12 grid gap-10 md:grid-cols-4">
        <div>
          <Wordmark light />
          <p className="text-white/60 text-sm mt-4 max-w-xs">
            Manitoba&apos;s fishing companion — lake directory, 2026 regulations,
            lodges &amp; guides, and the angler community. Free.
          </p>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gold mb-4">
            Explore
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/fishmb/contact" className="text-white/70 hover:text-white">Contact us</Link></li>
            <li><Link href="/fishmb/lakes" className="text-white/70 hover:text-white">Lake directory</Link></li>
            <li><Link href="/fishmb/lodges" className="text-white/70 hover:text-white">Lodges &amp; guides</Link></li>
            <li><Link href="/fishmb/regulations" className="text-white/70 hover:text-white">Fishing regulations</Link></li>
            <li><Link href="/fishmb/hot-lakes" className="text-white/70 hover:text-white">Hot lakes</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gold mb-4">
            Community
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/fishmb/feed" className="text-white/70 hover:text-white">Angler feed</Link></li>
            <li><Link href="/fishmb/tournaments" className="text-white/70 hover:text-white">Tournaments</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gold mb-4">
            Good to know
          </h3>
          <p className="text-white/50 text-xs leading-relaxed">
            Regulations summaries are from the 2026 Manitoba Anglers&apos; Guide.
            Always confirm against the official guide before you fish — limits
            and seasons can change.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
          <span>© 2026 FishMB. Fish hard, release harder.</span>
          <span>
            Tackle up at{" "}
            <a href="https://www.wallyworldtackle.ca" className="text-gold hover:text-white">
              wallyworldtackle.ca
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
