// "Send this spot to a friend" picker — lists your friends; tapping one
// sends the spot into your Messages thread with them (see sendSpot.ts).
// Rendered through a portal so no sheet/transform can clip it.

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useFishAuth } from "./FishAuth";
import { fishFetch } from "./fishFetch";
import { sendSpotToFriend, type SpotShareData } from "../messages/_components/sendSpot";

interface Friend {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface Props {
  spot: SpotShareData & { displayName: string };
  onClose: () => void;
}

export default function SendSpotPicker({ spot, onClose }: Props) {
  const { user } = useFishAuth();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<{ friend: Friend; convoId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fishFetch("/api/fish/friends")
      .then((d) => setFriends(((d as { friends?: Friend[] }).friends ?? []) as Friend[]))
      .catch(() => setFriends([]));
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const send = async (f: Friend) => {
    if (!user || sendingId) return;
    setSendingId(f.id);
    setError(null);
    try {
      const convoId = await sendSpotToFriend(user.id, user.name, f.id, spot);
      setSentTo({ friend: f, convoId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the spot.");
    } finally {
      setSendingId(null);
    }
  };

  const sheet = (
    <div
      className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-pine-deep/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Send spot to a friend"
    >
      <div
        className="bg-paper rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-pine/20 rounded-full mx-auto mb-4 sm:hidden" />
        <h3 className="font-display font-bold uppercase text-pine text-xl tracking-wide mb-1">
          Send spot to a friend
        </h3>
        <p className="text-sm text-pine/60 mb-4">
          📍 {spot.displayName} — it lands in your Messages with them. If they
          accept, it becomes their own spot to edit.
        </p>

        {error && (
          <p className="text-sm text-signal-dark bg-signal/10 border border-signal/25 rounded-2xl px-4 py-3 mb-4">
            {error}
          </p>
        )}

        {sentTo ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">🎣</p>
            <p className="font-bold text-pine mb-1">Spot sent to {sentTo.friend.name}!</p>
            <p className="text-sm text-pine/55 mb-5">
              They&apos;ll see it in Messages and can save it as their own spot.
            </p>
            <div className="flex gap-2.5 justify-center">
              <Link
                href={`/fishmb/messages?convo=${sentTo.convoId}`}
                className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
              >
                Open chat
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="bg-pine/10 hover:bg-pine/15 text-pine font-bold uppercase tracking-wider text-sm px-6 py-3 rounded-full transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : friends === null ? (
          <p className="text-pine/50 text-sm text-center py-6">Loading friends…</p>
        ) : friends.length === 0 ? (
          <p className="text-pine/50 text-sm text-center py-6">
            No friends yet — add friends first, then you can send them spots.
          </p>
        ) : (
          <div className="space-y-1.5">
            {friends.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={sendingId !== null}
                onClick={() => send(f)}
                className="w-full flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-3 text-left hover:shadow-md transition-shadow disabled:opacity-50"
              >
                {f.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <span className="w-11 h-11 rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine">
                    {f.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-bold text-pine text-sm flex-1 truncate">{f.name}</span>
                <span className="text-signal-dark font-bold text-xs uppercase tracking-wider">
                  {sendingId === f.id ? "Sending…" : "Send →"}
                </span>
              </button>
            ))}
          </div>
        )}

        {!sentTo && (
          <button
            type="button"
            onClick={onClose}
            className="block mx-auto mt-5 text-sm font-bold uppercase tracking-wider text-pine/50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
