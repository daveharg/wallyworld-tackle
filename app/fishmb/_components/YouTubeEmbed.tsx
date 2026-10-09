"use client";

import { useEffect, useRef, useState } from "react";

/** Extract a YouTube video ID from watch / youtu.be / shorts / embed URLs. */
export function extractYouTubeId(text: string): string | null {
  const m = text.match(
    /(?:youtube\.com\/(?:watch\?[^#\s]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

/**
 * Inline YouTube player that auto-plays (muted, playsinline) when scrolled
 * into view and pauses when scrolled away — right inside the post's own box.
 * iOS blocks unmuted autoplay, so playback starts muted with a tap-to-unmute
 * button. Tapping the video itself toggles sound too.
 */
export default function YouTubeEmbed({ videoId }: { videoId: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [muted, setMuted] = useState(true);
  const [unmuted, setUnmuted] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { threshold: 0.75 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Re-mute whenever a fresh autoplay starts (browser policy for autoplay).
  useEffect(() => {
    if (inView) {
      setMuted(true);
      setUnmuted(false);
    }
  }, [inView, videoId]);

  const tapForSound = () => {
    setMuted(false);
    setUnmuted(true);
  };

  const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${
    muted ? 1 : 0
  }&playsinline=1&rel=0&modestbranding=1`;

  return (
    <div
      ref={boxRef}
      className="relative w-[calc(100%+2.5rem)] -mx-5 max-sm:rounded-none overflow-hidden rounded-2xl bg-black/90 mt-3"
      style={{ aspectRatio: "16 / 9" }}
    >
      {inView ? (
        <iframe
          key={`${videoId}-${muted ? "m" : "u"}`}
          src={src}
          title="YouTube video"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <img
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          alt="Video thumbnail"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      )}
      {/* First tap anywhere turns the sound on (tapping the YouTube frame
          itself would only pause). After that, taps go straight to YouTube. */}
      {inView && muted && !unmuted && (
        <button
          type="button"
          onClick={tapForSound}
          aria-label="Tap for sound"
          className="absolute inset-0 z-10 flex items-end justify-end p-3 bg-transparent"
        >
          <span className="rounded-full bg-black/65 text-white text-sm font-bold px-4 py-2 backdrop-blur-sm">
 Tap for sound
          </span>
        </button>
      )}
      {unmuted && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute video" : "Mute video"}
          className="absolute bottom-3 right-3 z-10 rounded-full bg-black/65 text-white text-sm font-bold px-4 py-2 backdrop-blur-sm"
        >
 {muted ? " Tap for sound" : ""}
        </button>
      )}
    </div>
  );
}
