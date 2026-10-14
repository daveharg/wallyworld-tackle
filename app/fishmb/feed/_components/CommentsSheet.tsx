// Full-screen Facebook-style comments view.
// Opens with the post image large at top; after 500ms it auto-collapses
// to bring the comments into focus.
//
// Comments support the shared press-and-hold menu (HoldMenu): Facebook's
// seven reactions, Reply, Copy, and Report. Reactions go through the
// real endpoint POST /api/fishmb/feed/<postId>/comments/<id>/react with
// the codes from lib/fish/reactions.ts.

"use client";

import { useEffect, useRef, useState } from "react";
import { fishFetch } from "../../_components/fishFetch";
import { useFishAuth } from "../../_components/FishAuth";
import { HoldMenu, ReactionChips, useLongPress } from "../../_components/HoldMenu";
import {
  FEED_REACTION_PICKER,
  FEED_REACTION_EMOJI,
} from "@/lib/fish/reactions";

interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url?: string | null;
  body: string;
  photo_url?: string | null;
  parent_id?: string | null;
  created_at: string;
  like_count?: number;
  dislike_count?: number;
  reaction_counts?: Record<string, number>;
  viewer_reaction?: number | null;
  replies?: Comment[];
  is_author?: boolean;
  is_admin?: boolean;
}

interface Post {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url?: string | null;
  body?: string | null;
  photo_url?: string | null;
  photos?: string[];
  created_at: string;
  like_count?: number;
  comment_count?: number;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function chipsOf(c: Comment) {
  return [...FEED_REACTION_PICKER, -1]
    .filter((code) => (c.reaction_counts?.[String(code)] ?? 0) > 0)
    .map((code) => ({
      key: String(code),
      emoji: FEED_REACTION_EMOJI[code],
      n: c.reaction_counts![String(code)],
      mine: c.viewer_reaction === code,
    }));
}

function CommentRow({
  comment,
  postUserId,
  depth = 0,
  activeId,
  onReply,
  onReact,
  onHold,
}: {
  comment: Comment;
  postUserId: string;
  depth?: number;
  activeId: string | null;
  onReply: (c: Comment) => void;
  onReact: (c: Comment, code: number) => void;
  onHold: (c: Comment, rect: DOMRect) => void;
}) {
  const handlers = useLongPress((rect) => onHold(comment, rect));
  const chips = chipsOf(comment);
  const active = activeId === comment.id;
  return (
    <div className={depth > 0 ? "ml-12" : ""}>
      <div
        {...handlers}
        style={{ WebkitTouchCallout: "none" }}
        className={`flex gap-3 px-4 py-3 transition-all duration-150 ${
          active ? "scale-[1.02] bg-signal/5 rounded-2xl shadow-lg ring-1 ring-signal/40 relative z-10" : ""
        }`}
      >
        {comment.avatar_url ? (
          <img
            src={comment.avatar_url}
            alt=""
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        ) : (
          <span className="w-10 h-10 rounded-full bg-pine/15 text-pine font-black flex items-center justify-center shrink-0">
            {comment.user_name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] leading-snug">
            <span className="font-bold text-pine">{comment.user_name}</span>
            <span className="text-pine/45 font-normal"> · {timeAgo(comment.created_at)}</span>
            {comment.user_id === postUserId && (
              <span className="ml-1.5 text-signal-dark font-bold text-[13px]">✎ Author</span>
            )}
          </p>
          <p className="text-[15px] text-pine leading-snug mt-0.5 whitespace-pre-wrap break-words">
            {comment.body}
          </p>
          {comment.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={comment.photo_url} alt="" className="mt-2 rounded-xl max-h-48 w-auto object-cover" />
          )}
          <ReactionChips chips={chips} onTap={(key) => onReact(comment, Number(key))} />
          <div className="flex items-center gap-4 mt-1.5">
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="text-pine/50 text-[13px] font-bold"
            >
              Reply
            </button>
          </div>
        </div>
        <div className="flex items-start gap-3 shrink-0 pt-1">
          <button
            type="button"
            onClick={() => onReact(comment, 1)}
            aria-label="Like comment"
            className={`text-xl ${comment.viewer_reaction === 1 ? "opacity-100" : "opacity-40 grayscale"}`}
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => onReact(comment, -1)}
            aria-label="Dislike comment"
            className={`text-xl ${comment.viewer_reaction === -1 ? "opacity-100" : "opacity-40 grayscale"}`}
          >
            👎
          </button>
        </div>
      </div>
      {(comment.replies ?? []).map((r) => (
        <CommentRow
          key={r.id}
          comment={r}
          postUserId={postUserId}
          depth={depth + 1}
          activeId={activeId}
          onReply={onReply}
          onReact={onReact}
          onHold={onHold}
        />
      ))}
    </div>
  );
}

export default function CommentsSheet({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const { user, openLogin } = useFishAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hold, setHold] = useState<{ comment: Comment; rect: DOMRect } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const photos = post.photos?.length ? post.photos : post.photo_url ? [post.photo_url] : [];

  useEffect(() => {
    fishFetch(`/api/fishmb/feed/${post.id}/comments`)
      .then((d) => setComments(d.comments ?? []))
      .catch(() => {});
    // After half a second, collapse the hero image to focus on comments.
    const t = setTimeout(() => setCollapsed(true), 500);
    return () => clearTimeout(t);
  }, [post.id]);

  /** Update one comment wherever it sits (top level or nested reply). */
  const patchComment = (id: string, patch: Partial<Comment>) => {
    const walk = (list: Comment[]): Comment[] =>
      list.map((c) =>
        c.id === id
          ? { ...c, ...patch }
          : c.replies
            ? { ...c, replies: walk(c.replies) }
            : c
      );
    setComments((prev) => walk(prev));
  };

  const reactToComment = async (comment: Comment, code: number) => {
    if (!user) {
      openLogin();
      return;
    }
    const next = comment.viewer_reaction === code ? null : code;
    try {
      const d = await fishFetch(
        `/api/fishmb/feed/${post.id}/comments/${comment.id}/react`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: next }),
        }
      );
      patchComment(comment.id, {
        like_count: d.like_count,
        dislike_count: d.dislike_count,
        reaction_counts: d.reaction_counts,
        viewer_reaction: d.viewer_reaction,
      });
      // Keep the open menu's snapshot in sync so its active state is right.
      setHold((h) =>
        h && h.comment.id === comment.id
          ? { ...h, comment: { ...h.comment, reaction_counts: d.reaction_counts, viewer_reaction: d.viewer_reaction } }
          : h
      );
    } catch {
      // non-fatal
    }
  };

  const reportComment = async (comment: Comment) => {
    try {
      await fishFetch("/api/fishmb/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "comment", target_id: comment.id, reason: "" }),
      });
      setNote("Reported — thanks. We review every report within 24 hours.");
    } catch {
      setNote("Couldn't send the report — try again.");
    }
    setTimeout(() => setNote(null), 3000);
  };

  const copyComment = async (comment: Comment) => {
    try {
      await navigator.clipboard.writeText(comment.body);
      setNote("Copied.");
      setTimeout(() => setNote(null), 2000);
    } catch {
      // Clipboard unavailable — nothing sensible to fall back to here.
    }
  };

  const send = async () => {
    if (!user) {
      openLogin();
      return;
    }
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const d = await fishFetch(`/api/fishmb/feed/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draft.trim(),
          parent_id: replyTo?.id ?? null,
        }),
      });
      if (replyTo) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTo.id
              ? { ...c, replies: [...(c.replies ?? []), d.comment] }
              : c
          )
        );
      } else {
        setComments((prev) => [...prev, d.comment]);
      }
      setDraft("");
      setReplyTo(null);
    } catch {
      // non-fatal
    } finally {
      setBusy(false);
    }
  };

  const holdComment = hold ? comments.find((c) => c.id === hold.comment.id) ?? hold.comment : null;

  return (
    <div className="fixed inset-0 z-[1200] bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-pine/10 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="text-pine text-2xl leading-none"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-pine text-[17px] truncate">{post.user_name}</p>
          <p className="text-pine/45 text-xs">{timeAgo(post.created_at)}</p>
        </div>
        <button type="button" aria-label="More options" className="text-pine text-2xl tracking-widest">
          •••
        </button>
      </div>

      {note && (
        <p className="px-4 py-2 text-sm font-bold text-signal-dark bg-signal/10 border-b border-signal/20">
          {note}
        </p>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Post hero image — collapses after 500ms */}
        {photos.length > 0 && (
          <div
            className="overflow-hidden transition-all duration-500 ease-in-out"
            style={{ maxHeight: collapsed ? 180 : 600 }}
          >
            <img
              src={photos[0]}
              alt=""
              className="w-full object-cover"
              style={{ height: collapsed ? 180 : "auto", maxHeight: 600 }}
            />
          </div>
        )}
        {post.body && (
          <p className="px-4 py-3 text-[15px] text-pine whitespace-pre-wrap break-words">
            {post.body}
          </p>
        )}

        {/* Like / comment counts */}
        <div className="flex items-center gap-6 px-4 py-2 border-b border-pine/10">
          <span className="flex items-center gap-1.5 text-pine/60 text-sm font-bold">
            👍 {post.like_count ?? 0}
          </span>
          <span className="flex items-center gap-1.5 text-pine/60 text-sm font-bold">
            💬 {post.comment_count ?? comments.length}
          </span>
        </div>

        {/* Comments */}
        <div className="pb-4 divide-y divide-pine/5">
          {comments.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              postUserId={post.user_id}
              activeId={hold?.comment.id ?? null}
              onReply={(comment) => {
                setReplyTo(comment);
                inputRef.current?.focus();
              }}
              onReact={reactToComment}
              onHold={(comment, rect) => setHold({ comment, rect })}
            />
          ))}
          {comments.length === 0 && (
            <p className="px-4 py-8 text-center text-pine/40 text-sm">
              No comments yet. Start the conversation!
            </p>
          )}
        </div>
      </div>

      {/* Press-and-hold menu for a comment */}
      {hold && holdComment && (
        <HoldMenu
          anchor={hold.rect}
          reactions={FEED_REACTION_PICKER.map((code) => ({
            key: String(code),
            emoji: FEED_REACTION_EMOJI[code],
            active: holdComment.viewer_reaction === code,
          }))}
          onPickReaction={(key) => reactToComment(holdComment, Number(key))}
          actions={[
            {
              icon: "↩️",
              label: "Reply",
              onSelect: () => {
                setReplyTo(holdComment);
                inputRef.current?.focus();
              },
            },
            {
              icon: "📋",
              label: "Copy text",
              onSelect: () => copyComment(holdComment),
            },
            ...(user && holdComment.user_id !== user.id
              ? [
                  {
                    icon: "🚩",
                    label: "Report comment",
                    onSelect: () => reportComment(holdComment),
                  },
                ]
              : []),
          ]}
          onClose={() => setHold(null)}
        />
      )}

      {/* Comment input */}
      <div className="border-t border-pine/10 bg-white px-3 py-2.5 shrink-0">
        {replyTo && (
          <div className="flex items-center justify-between px-2 pb-1.5">
            <span className="text-xs font-bold text-pine/60">
              Replying to {replyTo.user_name}
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-pine/50 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-pine/15 text-pine font-black flex items-center justify-center text-sm">
              {(user?.name ?? "?").charAt(0).toUpperCase()}
            </span>
          )}
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder={`Comment as ${user?.name ?? "guest"}`}
            className="flex-1 bg-pine/5 rounded-full px-4 py-2.5 text-[15px] text-pine placeholder:text-pine/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || busy}
            aria-label="Send comment"
            className="w-10 h-10 rounded-full bg-signal text-white flex items-center justify-center disabled:opacity-40 shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 9l14-6-4 14-4-5-6-3z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
