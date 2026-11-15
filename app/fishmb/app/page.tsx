import BackArrow from "../_components/BackArrow";

/**
 * "Get the app" page — the native FishMB app isn't on the stores yet, so
 * this is a simple coming-soon note (Dave, 2026-11-15). The old PWA
 * install-instructions page is preserved as page.legacy.tsx.
 */
export default function FishMBAppPage() {
  return (
    <main className="min-h-screen bg-paper text-pine px-5 pt-24 pb-16 max-w-md mx-auto">
      <BackArrow />
      <h1 className="text-3xl font-black mt-4">The FishMB app is coming soon</h1>
      <p className="text-pine/70 mt-2 leading-relaxed">
        We&apos;re building the FishMB app for iPhone and Android. When it
        lands on the App Store and Google Play, this page is where you&apos;ll
        get it.
      </p>
      <p className="text-pine/70 mt-4 leading-relaxed">
        Until then, everything FishMB lives right here on the website —
        lakes, maps, weather and regulations included.
      </p>
    </main>
  );
}
