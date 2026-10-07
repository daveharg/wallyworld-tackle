"use client";

import { useEffect, useState } from "react";
import { useFishAuth } from "../../_components/FishAuth";
import { fishFetch } from "../../_components/fishFetch";

interface Tip {
  id: string;
  body: string;
  created_at: string;
  user: { id: string; name: string; avatar_url: string | null };
}

/** Angler tips on a how-to-fish page. Posting also drops the tip in the community feed. */
export function SpeciesTips({ species }: { species: string }) {
  const { user, openLogin } = useFishAuth();
  const [tips, setTips] = useState<Tip[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fishFetch(`/api/fish/discussions?species_tag=${encodeURIComponent(species)}&limit=20`)
      .then((d) => setTips(d.discussions ?? []))
      .catch(() => {});
  }, [species]);

  const submit = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!draft.trim() || posting) return;
    setPosting(true);
    setNote(null);
    try {
      const d = await fishFetch("/api/fish/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim(), species_tag: species }),
      });
      setTips([d.discussion, ...tips]);
      setDraft("");
      setOpen(false);
      setNote("Tip posted — it's in the community feed too! 🎣");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not post your tip.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold uppercase text-pine text-2xl md:text-3xl tracking-wide">
          Angler tips
        </h2>
        <button
          onClick={() => (user ? setOpen((o) => !o) : openLogin())}
          className="bg-signal hover:bg-signal-dark text-white font-bold uppercase tracking-wider text-xs px-5 py-2.5 rounded-full transition-colors"
        >
          {open ? "Close" : "+ Add a fishing tip"}
        </button>
      </div>

      {open && (
        <div className="bg-white border border-pine/10 rounded-3xl p-5 mb-6">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={`Your best ${species.toLowerCase()} tip…`}
            className="w-full bg-paper-deep border border-pine/15 rounded-2xl px-4 py-3 text-pine text-sm placeholder:text-pine/40 focus:outline-none focus:border-signal resize-none"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={submit}
              disabled={posting || !draft.trim()}
              className="bg-pine hover:bg-pine-deep text-white font-bold uppercase tracking-wider text-xs px-6 py-2.5 rounded-full disabled:opacity-40 transition-colors"
            >
              {posting ? "Posting…" : "Post tip"}
            </button>
          </div>
        </div>
      )}

      {note && <p className="text-sm text-pine bg-gold/20 border border-gold/50 rounded-2xl px-4 py-3 mb-5">{note}</p>}

      {tips.length === 0 ? (
        <p className="text-pine/55 text-sm bg-white border border-pine/10 rounded-2xl p-6">
          No tips yet — be the first to share what works for {species.toLowerCase()}.
        </p>
      ) : (
        <ul className="space-y-3">
          {tips.map((t) => (
            <li key={t.id} className="bg-white border border-pine/10 rounded-2xl p-5">
              <div className="flex items-center gap-2.5 mb-2">
                {t.user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-signal text-white flex items-center justify-center font-bold text-xs">
                    {t.user.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <p className="text-xs font-bold text-pine">
                  {t.user.name} <span className="font-normal text-pine/45">shared a tip</span>
                </p>
              </div>
              <p className="text-pine/80 text-sm">{t.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
