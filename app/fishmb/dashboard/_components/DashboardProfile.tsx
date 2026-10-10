// Dashboard "Profile" tab — full profile customization.
// Two tabs: "Your profile" (see what others see + Edit button) and "Friends"
// (search friends, view their profiles).

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";
import ProfileView from "../../profile/_components/ProfileView";
import DashboardSettings from "./DashboardSettings";

interface Friend {
  id: string;
  name: string;
  avatar_url: string | null;
}

export default function DashboardProfile() {
  const { user } = useFishAuth();
  const [tab, setTab] = useState<"profile" | "friends">("profile");
  const [editing, setEditing] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [search, setSearch] = useState("");
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    if (tab !== "friends") return;
    setLoadingFriends(true);
    fishFetch("/api/fish/friends")
      .then((d) => {
        const list = (d as { friends?: Friend[] }).friends ?? [];
        setFriends(list);
      })
      .catch(() => {})
      .finally(() => setLoadingFriends(false));
  }, [tab]);

  if (!user) return null;

  const filtered = friends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        {(["profile", "friends"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-colors ${
              tab === t
                ? "bg-pine text-white"
                : "bg-pine/5 text-pine/60 hover:text-pine"
            }`}
          >
            {t === "profile" ? "Your profile" : "Friends"}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <div>
          {!editing ? (
            <>
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setEditing(true)}
                  className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-sm px-6 py-2.5 rounded-full transition-colors"
                >
                  Edit profile
                </button>
              </div>
              <ProfileView userId={user.id} />
            </>
          ) : (
            <div>
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setEditing(false)}
                  className="text-sm font-bold uppercase tracking-wider text-pine/60 hover:text-pine px-4 py-2"
                >
                  ← Back to profile
                </button>
              </div>
              <DashboardSettings />
            </div>
          )}
        </div>
      ) : (
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends…"
            className="w-full bg-white border border-pine/15 rounded-full px-5 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal mb-4"
          />
          {loadingFriends ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="aspect-square bg-pine/5 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-pine/50 text-center py-8">
              {search ? "No friends match your search." : "No friends yet — add some from the Friends page."}
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {filtered.map((f) => (
                <Link
                  key={f.id}
                  href={`/fishmb/anglers/${f.id}`}
                  className="bg-white border border-pine/10 rounded-3xl p-4 text-center hover:border-signal/40 transition-colors"
                >
                  {f.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.avatar_url} alt={f.name} className="w-20 h-20 rounded-full object-cover mx-auto mb-2" />
                  ) : (
                    <span className="w-20 h-20 rounded-full bg-pine/10 text-pine flex items-center justify-center font-bold text-2xl mx-auto mb-2">
                      {f.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <p className="font-bold text-pine text-sm truncate">{f.name}</p>
                </Link>
              ))}
            </div>
          )}
          <Link
            href="/fishmb/friends"
            className="block text-center mt-6 text-sm font-bold uppercase tracking-wider text-signal-dark hover:underline"
          >
            Manage friends →
          </Link>
        </div>
      )}
    </div>
  );
}
