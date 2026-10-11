"use client";

import { useEffect, useState } from "react";
import BackArrow from "../_components/BackArrow";

/**
 * "Get the app" install page — PWA install instructions for iOS and Android.
 * Previously this route blindly redirected to /fishmb/feed, so the header's
 * "Get the app" button appeared to do nothing.
 */
export default function FishMBAppInstallPage() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setCanInstall(false);
  };

  return (
    <main className="min-h-screen bg-paper text-pine px-5 pt-24 pb-16 max-w-md mx-auto">
      <BackArrow />
      <h1 className="text-3xl font-black mt-4">Get the FishMB app</h1>
      <p className="text-pine/70 mt-2 leading-relaxed">
        FishMB installs as an app on your phone — full screen, with its own
        icon. No app store needed.
      </p>

      {canInstall && (
        <button
          onClick={install}
          className="mt-6 w-full bg-signal text-white font-black rounded-2xl py-4 text-lg shadow-lg"
        >
          Install FishMB now
        </button>
      )}

      <div className="mt-8 space-y-4">
        <div className="bg-white border border-pine/10 rounded-2xl p-5">
          <p className="font-black text-lg">iPhone (Safari)</p>
          <ol className="text-sm text-pine/70 mt-2 space-y-1.5 list-decimal list-inside">
            <li>Tap the <strong>Share</strong> button at the bottom of Safari</li>
            <li>Tap <strong>Add to Home Screen</strong></li>
            <li>Tap <strong>Add</strong> — FishMB appears with your other apps</li>
          </ol>
        </div>
        <div className="bg-white border border-pine/10 rounded-2xl p-5">
          <p className="font-black text-lg">Android (Chrome)</p>
          <ol className="text-sm text-pine/70 mt-2 space-y-1.5 list-decimal list-inside">
            <li>Tap the <strong>⋮ menu</strong> at the top right of Chrome</li>
            <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong></li>
            <li>Confirm — FishMB appears with your other apps</li>
          </ol>
        </div>
      </div>

      <p className="text-xs text-pine/50 mt-8 leading-relaxed">
        The installed app opens straight to your feed and works best with
        notifications turned on (Settings → Push notifications).
      </p>
    </main>
  );
}
