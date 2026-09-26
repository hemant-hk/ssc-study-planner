"use client";

import { useState, useEffect } from "react";

interface DiscussionComment {
  id: string;
  videoId: string;
  author: string;
  text: string;
  timestamp: string;
  upvotes: number;
}

interface DiscussionThreadProps {
  videoId: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatTime(iso);
}

export default function DiscussionThread({ videoId }: DiscussionThreadProps) {
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/discussions?videoId=${encodeURIComponent(videoId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setComments(Array.isArray(data.comments) ? data.comments : []);
      })
      .catch(() => {
        if (active) setError("Failed to load discussions");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [videoId]);

  async function post() {
    const trimmedText = text.trim();
    const trimmedAuthor = author.trim();
    if (!trimmedText || !trimmedAuthor || posting) return;

    setPosting(true);
    setError("");
    try {
      const res = await fetch("/api/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, author: trimmedAuthor, text: trimmedText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post");
      setComments((prev) => [data.comment, ...prev]);
      setText("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  function sortComments(list: DiscussionComment[]): DiscussionComment[] {
    return [...list].sort((a, b) => b.upvotes - a.upvotes || +new Date(b.timestamp) - +new Date(a.timestamp));
  }

  async function toggleUpvote(id: string) {
    const isVoted = !!voted[id];
    const optimistic = isVoted ? -1 : 1;
    setVoted((prev) => ({ ...prev, [id]: !isVoted }));
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, upvotes: Math.max(0, c.upvotes + optimistic) } : c))
    );
    try {
      const res = await fetch("/api/discussions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, increment: !isVoted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setComments((prev) =>
        prev.map((c) => (c.id === id ? data.comment : c))
      );
    } catch (err: unknown) {
      setVoted((prev) => ({ ...prev, [id]: isVoted }));
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, upvotes: Math.max(0, c.upvotes - optimistic) } : c))
      );
      setError(err instanceof Error ? err.message : "Failed to update vote");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Discussion</h3>
          <span className="text-xs text-zinc-400">({comments.length})</span>
        </div>
        <svg className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              post();
            }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
                maxLength={60}
                className="w-40 text-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
              />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask a question or share an insight…"
                className="flex-1 text-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 outline-none focus:border-white/50"
              />
              <button
                type="submit"
                disabled={posting || !author.trim() || !text.trim()}
                className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </form>

          {loading ? (
            <p className="text-xs text-zinc-400 text-center py-4">Loading discussions…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">
              No discussions yet. Be the first to ask a question!
            </p>
          ) : (
            <div className="space-y-3">
              {sortComments(comments).map((comment) => (
                <div key={comment.id} className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {comment.author.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{comment.author}</span>
                    <span className="text-[10px] text-zinc-400">{timeAgo(comment.timestamp)}</span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap mb-2">{comment.text}</p>
                  <button
                    onClick={() => toggleUpvote(comment.id)}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                      voted[comment.id]
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                        : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                    }`}
                  >
                    <svg className={`w-3.5 h-3.5 ${voted[comment.id] ? "fill-current" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    {comment.upvotes}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}