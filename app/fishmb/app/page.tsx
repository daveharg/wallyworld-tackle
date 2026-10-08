"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

/** "Get the FishMB app" — installs to the Home Screen, runs full-screen like a native app. */
export default function FishMBAppPage() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstallEvent(null);
  };

  const card = "bg-white border border-pine/10 rounded-3xl p-6 md:p-8";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <p className="text-gold font-bold uppercase tracking-[0.28em] text-sm mb-3 text-center">
        FishMB on your phone
      </p>
      <h1 className="font-display font-bold uppercase text-pine text-4xl md:text-5xl tracking-wide text-center mb-4">
        Get the FishMB app
      </h1>
      <p className="text-pine/70 text-center max-w-xl mx-auto mb-10">
        Add FishMB to your Home Screen and it runs full-screen like a native
        app — lakes, regulations, tournaments, the feed, all of it. No app
        store needed.
      </p>

      {installed && (
        <p className="text-center text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-8">
          🎉 FishMB is installed — look for it on your Home Screen.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-5 mb-8">
        {/* Android / Chrome */}
        <div className={card}>
          <p className="text-3xl mb-3">🤖</p>
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-3">
            Android / Chrome
          </h2>
          {installEvent && !installed ? (
            <button
              onClick={install}
              className="w-full bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-3.5 rounded-full transition-colors mb-4"
            >
              Install FishMB
            </button>
          ) : (
            <ol className="text-pine/75 text-sm space-y-2.5 list-decimal list-inside">
              <li>Tap the <strong>Menu ⋮</strong> in Chrome</li>
              <li>Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>)</li>
              <li>Tap <strong>Install</strong> — done, it&apos;s on your Home Screen</li>
            </ol>
          )}
          <p className="text-xs text-pine/50 mt-4">
            If you don&apos;t see an Install button yet, use the menu steps above.
          </p>
        </div>

        {/* iOS Safari */}
        <div className={card}>
          <p className="text-3xl mb-3">🍎</p>
          <h2 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-3">
            iPhone / Safari
          </h2>
          <ol className="text-pine/75 text-sm space-y-2.5 list-decimal list-inside">
            <li>Tap the <strong>Share</strong> button (square with an arrow ⬆️)</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
            <li>Tap <strong>Add</strong> — FishMB launches full-screen from your Home Screen</li>
          </ol>
          <p className="text-xs text-pine/50 mt-4">
            Must be done in Safari — it doesn&apos;t work from inside other apps.
          </p>
        </div>
      </div>

      <div className="bg-pine rounded-3xl p-6 md:p-8 text-center mb-8">
        <p className="text-white/85 text-sm max-w-xl mx-auto">
          Everything in FishMB already works right in your browser — the
          installed app is the same site, full-screen. Offline catch logging
          for when you&apos;re out of service is coming to the app next.
        </p>
      </div>

      <div className="text-center">
        <Link
          href="/fishmb"
          className="inline-block bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-10 py-4 rounded-full transition-colors"
        >
          Open FishMB
        </Link>
      </div>
    </div>
  );
}
