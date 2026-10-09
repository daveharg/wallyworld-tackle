import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/fish/db";

export const dynamic = "force-dynamic";

interface SharePost {
  id: string;
  kind: string;
  user_name: string;
  body: string | null;
  photo_url: string | null;
  species: string | null;
  visibility: string;
}

async function getSharePost(id: string): Promise<SharePost | null> {
  // Catches and discussions both appear in the feed.
  const catches = await query<SharePost>(
    `SELECT c.id, 'catch' AS kind, u.name AS user_name, c.note AS body,
            COALESCE(c.photo_hold_url, c.photo_measure_url) AS photo_url,
            c.species, c.visibility
       FROM fm_catches c JOIN fm_users u ON u.id = c.user_id
      WHERE c.id = $1 AND c.visibility = 'public'
      LIMIT 1`,
    [id]
  );
  if (catches[0]) return catches[0];
  const posts = await query<SharePost>(
    `SELECT d.id, 'post' AS kind, u.name AS user_name, d.body AS body,
            d.photo_url AS photo_url, NULL AS species, d.visibility
       FROM fm_discussions d JOIN fm_users u ON u.id = d.user_id
      WHERE d.id = $1 AND d.visibility = 'public'
      LIMIT 1`,
    [id]
  );
  return posts[0] ?? null;
}

const FALLBACK_OG = "https://www.fishmb.ca/fishmb/og-share.png";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const post = await getSharePost(params.id);
  if (!post) return { title: "FishMB" };
  const title =
    post.kind === "catch" && post.species
      ? `${post.user_name}'s ${post.species} catch — FishMB`
      : `${post.user_name} on FishMB`;
  const description = (post.body ?? "").slice(0, 160) || "Manitoba fishing — lakes, catches, and anglers.";
  const image = post.photo_url || FALLBACK_OG;
  const url = `https://www.fishmb.ca/fishmb/share/${post.id}`;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "FishMB",
      title,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharePage({ params }: { params: { id: string } }) {
  const post = await getSharePost(params.id);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl border border-pine/10 shadow-xl overflow-hidden">
        {post.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.photo_url} alt="" className="w-full aspect-[4/3] object-cover" />
        )}
        <div className="p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-pine/50 mb-2">
            FishMB · {post.kind === "catch" ? "Catch" : "Post"}
          </p>
          <h1 className="font-display font-bold text-2xl text-pine mb-2">
            {post.kind === "catch" && post.species
              ? `${post.user_name}'s ${post.species}`
              : `${post.user_name} shared on FishMB`}
          </h1>
          {post.body && <p className="text-pine/70 text-[15px] mb-5">{post.body}</p>}
          <Link
            href="/fishmb/feed"
            className="block text-center bg-pine text-white font-bold rounded-full py-3.5"
          >
            Open in FishMB
          </Link>
          <Link
            href="/fishmb/app"
            className="block text-center text-pine/60 font-bold text-sm mt-3"
          >
            Get the app
          </Link>
        </div>
      </div>
    </div>
  );
}
