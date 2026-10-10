// Facebook-style stories row — sits right under the mobile header.
// Shows your own "Create story" card plus stories from friends and people you follow.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";
import { useFishAuth } from "../../_components/FishAuth";
import StoryCreator from "./StoryCreator";

interface Story {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  viewed: boolean;
  overlays?: { text: string; x: number; y: number; font: string; color: string; bg: string; size: number }[];
  zoom?: number;
  volume?: number | null;
}

export default function StoriesRow() {
  const { user } = useFishAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewing, setViewing] = useState<Story | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteViewingStory = async () => {
    if (!viewing) return;
    setDeleting(true);
    try {
      await fishFetch(`/api/fishmb/stories/${viewing.id}`, { method: "DELETE" });
      const deletedId = viewing.id;
      setStories((list) => list.filter((s) => s.id !== deletedId));
      setViewing(null);
      setConfirmDelete(false);
    } catch {
      // keep viewer open on failure
    } finally {
      setDeleting(false);
    }
  };

  const sortStories = (list: Story[]) => {
    // Unviewed first, then viewed (watched stories drop to the end of the queue).
    // Within each group, group by user, newest user first.
    const byUser = new Map<string, Story[]>();
    for (const s of list) {
      const l = byUser.get(s.user_id) ?? [];
      l.push(s);
      byUser.set(s.user_id, l);
    }
    const groups = Array.from(byUser.values());
    groups.sort((a, b) => {
      const aViewed = a.every((s) => s.viewed);
      const bViewed = b.every((s) => s.viewed);
      if (aViewed !== bViewed) return aViewed ? 1 : -1;
      return new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime();
    });
    return groups.flat();
  };

  const load = async () => {
    try {
      const d = await fishFetch("/api/fishmb/stories");
      setStories(sortStories(((d as { stories?: Story[] }).stories ?? []) as Story[]));
    } catch {
      // Stories stay empty.
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openViewer = async (s: Story) => {
    setViewing(s);
    try {
      await fishFetch(`/api/fishmb/stories/${s.id}/view`, { method: "POST" });
      setStories((list) =>
        sortStories(list.map((x) => (x.id === s.id ? { ...x, viewed: true } : x)))
      );
    } catch {
      // View tracking is best-effort.
    }
  };

  // Tap-to-advance: next story from same person, then next person's stories.
  const advanceStory = () => {
    if (!viewing) return;
    const userStories = stories.filter((s) => s.user_id === viewing.user_id);
    const idx = userStories.findIndex((s) => s.id === viewing.id);
    if (idx >= 0 && idx < userStories.length - 1) {
      openViewer(userStories[idx + 1]);
      return;
    }
    // Move to next person's first story.
    const userIds = Array.from(new Set(stories.map((s) => s.user_id)));
    const userIdx = userIds.indexOf(viewing.user_id);
    const nextUserId = userIds[userIdx + 1];
    if (nextUserId) {
      const nextStory = stories.find((s) => s.user_id === nextUserId);
      if (nextStory) {
        openViewer(nextStory);
        return;
      }
    }
    setViewing(null);
  };

  // Group stories by user — one card per person, newest story as the cover.
  const byUser = new Map<string, Story[]>();
  for (const s of stories) {
    const list: Story[] = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }
  const cards = Array.from(byUser.entries()).map(([userId, list]: [string, Story[]]) => ({
    userId,
    userName: list[0].user_name,
    avatarUrl: list[0].avatar_url,
    cover: list[0],
    allViewed: list.every((s) => s.viewed),
    count: list.length,
  }));

  if (!user) return null;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 mb-4" style={{ scrollbarWidth: "none" }}>
        {/* Create story card */}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="shrink-0 w-28 h-44 rounded-3xl bg-white border border-pine/10 overflow-hidden relative text-left"
        >
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-pine/10 flex items-center justify-center">
              <span className="text-3xl font-bold text-pine/40">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="absolute left-1/2 -translate-x-1/2 bottom-10 w-10 h-10 rounded-full bg-signal text-white flex items-center justify-center text-2xl font-bold border-4 border-white">
            +
          </span>
          <span className="absolute bottom-0 inset-x-0 pt-6 pb-2 text-center text-xs font-bold text-white bg-gradient-to-t from-black/60 to-transparent">
            Create story
          </span>
        </button>

        {/* Story cards */}
        {cards.map((c) => (
          <button
            key={c.userId}
            type="button"
            onClick={() => openViewer(c.cover)}
            className="shrink-0 w-28 h-44 rounded-3xl overflow-hidden relative text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.cover.media_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
            {c.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.avatarUrl}
                alt={c.userName}
                className={`absolute top-2 left-2 w-10 h-10 rounded-full object-cover border-[3px] ${
                  c.allViewed ? "border-white/40" : "border-signal"
                }`}
              />
            ) : (
              <span
                className={`absolute top-2 left-2 w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center font-bold text-white border-[3px] ${
                  c.allViewed ? "border-white/40" : "border-signal"
                }`}
              >
                {c.userName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute bottom-2 inset-x-2 text-white text-xs font-bold leading-tight line-clamp-2">
              {c.userName}
            </span>
          </button>
        ))}
      </div>

      {/* Full-screen story creator */}
      {creating && (
        <StoryCreator
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {/* Story viewer */}
      {viewing && (() => {
        const userStories = stories.filter((s) => s.user_id === viewing.user_id);
        const storyIdx = userStories.findIndex((s) => s.id === viewing.id);
        return (
        <div className="fixed inset-0 z-[1300] bg-black" onClick={advanceStory}>
          {/* Media fills the entire screen, edge to edge */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `scale(${viewing.zoom ?? 1})`, transformOrigin: "center" }}
            >
              {viewing.media_type === "video" ? (
                <video
                  src={viewing.media_url}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  onLoadedMetadata={(e) => {
                    if (viewing.volume != null) e.currentTarget.volume = viewing.volume;
                  }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewing.media_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            {(viewing.overlays ?? []).map((o, i) => (
              <span
                key={i}
                className="absolute whitespace-nowrap font-extrabold"
                style={{
                  left: `${o.x}%`,
                  top: `${o.y}%`,
                  transform: "translate(-50%, -50%)",
                  color: o.color,
                  background: o.bg,
                  fontSize: `${o.size}px`,
                  padding: o.bg !== "transparent" ? "4px 12px" : undefined,
                  borderRadius: o.bg !== "transparent" ? "12px" : undefined,
                  textShadow: o.bg === "transparent" ? "0 2px 8px rgba(0,0,0,0.6)" : undefined,
                }}
              >
                {o.text}
              </span>
            ))}
          </div>
          {/* Overlay header: progress bars + profile, floating over the media */}
          <div className="absolute top-0 inset-x-0 z-10" onClick={(e) => e.stopPropagation()}>
            {/* Progress bars */}
            <div className="flex gap-1 px-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
              {userStories.map((s) => (
                <div key={s.id} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${userStories.indexOf(s) <= storyIdx ? "bg-white" : "bg-transparent"}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 p-4 text-white">
              <Link
                href={`/fishmb/anglers/${viewing.user_id}`}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
                aria-label={`View ${viewing.user_name}'s profile`}
              >
                {viewing.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewing.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white/50 hover:border-white" />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/50 flex items-center justify-center font-bold hover:bg-white/30">
                    {viewing.user_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">{viewing.user_name}</p>
                <p className="text-xs text-white/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                  {new Date(viewing.created_at).toLocaleString()}
                </p>
              </div>
              {user && viewing.user_id === user.id && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(true);
                  }}
                  aria-label="Delete story"
                  className="w-9 h-9 mr-3 rounded-full bg-black/40 flex items-center justify-center text-white/90 hover:text-white hover:bg-black/60 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewing(null)}
                aria-label="Close story"
                className="text-white text-3xl leading-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
              >
                ×
              </button>
            </div>
          </div>
          {/* Delete confirmation */}
          {confirmDelete && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(false);
              }}
            >
              <div
                className="bg-white rounded-3xl p-6 w-full max-w-xs text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="font-bold text-pine text-lg mb-2">Delete this story?</p>
                <p className="text-pine/60 text-sm mb-5">It will be removed for everyone.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-3 rounded-full border border-pine/20 text-pine font-bold text-sm uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={deleteViewingStory}
                    disabled={deleting}
                    className="flex-1 py-3 rounded-full bg-red-500 text-white font-bold text-sm uppercase disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {viewing.caption && (
            <p className="absolute bottom-0 inset-x-0 z-10 p-4 text-white text-center text-sm drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" onClick={(e) => e.stopPropagation()}>
              {viewing.caption}
            </p>
          )}
        </div>
        );
      })()}
    </>
  );
}
