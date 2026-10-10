// Profile reels grid — tap to view, share to feed.

"use client";

import { useState } from "react";
import { fishFetch } from "../../_components/fishFetch";

interface Reel {
  id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
}

export default function ProfileReels({ reels, isSelf }: { reels: Reel[]; isSelf: boolean }) {
  const [viewing, setViewing] = useState<Reel | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  const shareToFeed = async () => {
    if (!viewing || sharing) return;
    setSharing(true);
    try {
      // Create a feed post linking the reel.
      await fishFetch("/api/fishmb/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: `Check out my reel! 🎬\n${viewing.caption ?? ""}`.trim(),
          kind: "post",
          visibility: "public",
        }),
      });
      setShared(true);
      window.setTimeout(() => {
        setShared(false);
        setViewing(null);
      }, 1500);
    } catch {
      // ignore
    } finally {
      setSharing(false);
    }
  };

  if (reels.length === 0) {
    return (
      <p className="text-center text-pine/50 py-12">
        {isSelf ? "Save stories as reels and they'll live here forever." : "No reels yet."}
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1.5 md:gap-3">
        {reels.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setViewing(r)}
            className="relative aspect-[9/16] rounded-xl overflow-hidden bg-paper-deep group"
          >
            {r.media_type === "video" ? (
              <video src={r.media_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.media_url} alt="" loading="lazy" className="w-full h-full object-cover" />
            )}
            {r.media_type === "video" && (
              <span className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reel viewer */}
      {viewing && (
        <div className="fixed inset-0 z-[1300] bg-black" onClick={() => setViewing(null)}>
          <div className="absolute inset-0 flex items-center justify-center">
            {viewing.media_type === "video" ? (
              <video src={viewing.media_url} controls autoPlay playsInline className="w-full h-full object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.media_url} alt="" className="w-full h-full object-contain" />
            )}
          </div>
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
            <span className="text-white font-bold text-sm drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">Reel</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={shareToFeed}
                disabled={sharing}
                className="px-4 py-2 rounded-full bg-white/20 backdrop-blur text-white text-xs font-bold uppercase tracking-wider hover:bg-white/30 transition-colors disabled:opacity-50"
              >
                {shared ? "Shared ✓" : sharing ? "Sharing…" : "Share to feed"}
              </button>
              <button
                type="button"
                onClick={() => setViewing(null)}
                aria-label="Close"
                className="text-white text-3xl leading-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
              >
                ×
              </button>
            </div>
          </div>
          {viewing.caption && (
            <p className="absolute bottom-0 inset-x-0 z-10 p-4 text-white text-center text-sm drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
              {viewing.caption}
            </p>
          )}
        </div>
      )}
    </>
  );
}
