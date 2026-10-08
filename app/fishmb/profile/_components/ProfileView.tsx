// Instagram-style angler profile: header (avatar, name, bio, counts),
// photo grid, and friends list. Used by /fishmb/profile (own) and
// /fishmb/anglers/[id] (public).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fishFetch } from "../../_components/fishFetch";
import FishingStats from "./FishingStats";
import MyRentals from "./MyRentals";

interface ProfilePhoto {
  url: string;
  created_at: string;
}

interface ProfileFriend {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface ProfileData {
  user: { id: string; name: string; avatar_url: string | null; bio: string | null };
  is_self: boolean;
  friendship_status: string | null;
  friendship_incoming: boolean;
  counts: { posts: number; catches: number; friends: number };
  photos: ProfilePhoto[];
  friends: ProfileFriend[];
}

function Avatar({ url, name, size }: { url: string | null; name: string; size: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={`${size} rounded-full object-cover border-2 border-gold`} />;
  }
  return (
    <div className={`${size} rounded-full bg-pine/10 flex items-center justify-center font-bold text-pine text-2xl`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ProfileView({
  userId,
  editor,
}: {
  userId: string;
  /** Extra node rendered under the header for the owner (edit form). */
  editor?: React.ReactNode;
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [tab, setTab] = useState<"photos" | "friends">("photos");
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fishFetch(`/api/fishmb/users/${userId}`)
      .then((d) => {
        if (live) setData(d);
      })
      .catch(() => {
        if (live) setData(null);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const sendRequest = async () => {
    setActing(true);
    setNote(null);
    try {
      const d = await fishFetch("/api/fish/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if ((d as { error?: string }).error) throw new Error((d as { error: string }).error);
      setNote("Friend request sent 🎣");
      const refreshed = await fishFetch(`/api/fishmb/users/${userId}`);
      setData(refreshed);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not send request.");
    } finally {
      setActing(false);
    }
  };

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-pine/50">
        Loading profile…
      </div>
    );
  }

  const { user, counts } = data;
  const stats = [
    { label: "Posts", value: counts.posts },
    { label: "Catches", value: counts.catches },
    { label: "Friends", value: counts.friends },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      {/* Header */}
      <div className="flex items-start gap-6 md:gap-10 mb-8">
        <Avatar url={user.avatar_url} name={user.name} size="w-24 h-24 md:w-32 md:h-32" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h1 className="font-display font-bold text-pine text-2xl md:text-3xl tracking-wide truncate">
              {user.name}
            </h1>
            {!data.is_self && (
              <>
                {data.friendship_status === "accepted" ? (
                  <span className="text-xs font-bold uppercase tracking-wider text-pine/50 bg-pine/10 rounded-full px-4 py-2">
                    Friends ✓
                  </span>
                ) : data.friendship_status === "pending" ? (
                  <span className="text-xs font-bold uppercase tracking-wider text-pine/50 bg-pine/10 rounded-full px-4 py-2">
                    {data.friendship_incoming ? "Request pending — check your friends page" : "Request sent"}
                  </span>
                ) : (
                  <button
                    onClick={sendRequest}
                    disabled={acting}
                    className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full disabled:opacity-50 transition-colors"
                  >
                    {acting ? "Sending…" : "Add friend"}
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex gap-6 mb-3">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display font-bold text-pine text-xl leading-none">{s.value}</p>
                <p className="text-xs text-pine/55 uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          {user.bio && <p className="text-pine/75 text-sm whitespace-pre-wrap">{user.bio}</p>}
        </div>
      </div>

      {note && (
        <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-6">{note}</p>
      )}

      {editor}

      <FishingStats userId={userId} />

      {data.is_self && <MyRentals />}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-pine/10 mb-6">
        {(["photos", "friends"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-4 text-sm font-bold uppercase tracking-wider transition-colors ${
              tab === t
                ? "text-signal-dark border-b-2 border-signal -mb-px"
                : "text-pine/45 hover:text-pine"
            }`}
          >
            {t === "photos" ? `📸 Photos (${data.photos.length})` : `🎣 Friends (${data.friends.length})`}
          </button>
        ))}
      </div>

      {tab === "photos" ? (
        data.photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5 md:gap-3">
            {data.photos.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${p.url}-${i}`}
                src={p.url}
                alt=""
                loading="lazy"
                className="w-full aspect-square object-cover rounded-xl bg-paper-deep"
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-pine/50 py-12">
            {data.is_self ? "Your catch and post photos will show up here." : "No photos yet."}
          </p>
        )
      ) : data.friends.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {data.friends.map((f) => (
            <Link
              key={f.id}
              href={`/fishmb/anglers/${f.id}`}
              className="flex items-center gap-3 bg-white border border-pine/10 rounded-2xl p-3 hover:shadow-md transition-shadow"
            >
              <Avatar url={f.avatar_url} name={f.name} size="w-11 h-11" />
              <span className="font-bold text-pine text-sm truncate">{f.name}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-center text-pine/50 py-12">
          {data.is_self ? (
            <>
              No friends yet.{" "}
              <Link href="/fishmb/friends" className="text-signal-dark font-bold">
                Find anglers →
              </Link>
            </>
          ) : (
            "No friends yet."
          )}
        </p>
      )}
    </div>
  );
}
