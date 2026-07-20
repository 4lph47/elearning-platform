"use client";

import { useState } from "react";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, Share2, Check } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";

interface Author {
  id: string;
  name: string;
}

export function LessonEngagementBar({
  lessonId,
  authors,
  viewCount,
  createdAt,
  initialLikeCount,
  initialDislikeCount,
  initialReaction,
  isAuthenticated,
}: {
  lessonId: string;
  authors: Author[];
  viewCount: number;
  createdAt: string;
  initialLikeCount: number;
  initialDislikeCount: number;
  initialReaction: "LIKE" | "DISLIKE" | null;
  isAuthenticated: boolean;
}) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [reaction, setReaction] = useState(initialReaction);
  const [copied, setCopied] = useState(false);
  const primaryAuthor = authors[0];

  async function react(type: "LIKE" | "DISLIKE") {
    if (!isAuthenticated) return;
    const next = reaction === type ? null : type;
    setReaction(next);

    const res = await fetch(`/api/lessons/${lessonId}/reaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setLikeCount(data.likeCount);
      setDislikeCount(data.dislikeCount);
    }
  }

  async function share() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
      {primaryAuthor && (
        <Link href={`/instructors/${primaryAuthor.id}`} className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {primaryAuthor.name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("")}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white hover:text-blue-400">
              {authors.map((a) => a.name).join(", ")}
            </p>
            <p className="text-xs text-slate-500">
              {viewCount} visualizaç{viewCount !== 1 ? "ões" : "ão"} · {timeAgo(createdAt)}
            </p>
          </div>
        </Link>
      )}

      <div className="flex items-center gap-2">
        <div className="flex overflow-hidden rounded-full border border-white/15">
          <button
            onClick={() => react("LIKE")}
            disabled={!isAuthenticated}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed ${
              reaction === "LIKE" ? "bg-blue-600/20 text-blue-400" : "text-slate-300 hover:bg-white/5"
            }`}
          >
            <ThumbsUp size={15} className={reaction === "LIKE" ? "fill-blue-400" : ""} /> {likeCount}
          </button>
          <div className="w-px bg-white/15" />
          <button
            onClick={() => react("DISLIKE")}
            disabled={!isAuthenticated}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed ${
              reaction === "DISLIKE" ? "bg-red-600/20 text-red-400" : "text-slate-300 hover:bg-white/5"
            }`}
          >
            <ThumbsDown size={15} className={reaction === "DISLIKE" ? "fill-red-400" : ""} /> {dislikeCount}
          </button>
        </div>

        <button
          onClick={share}
          className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/5"
        >
          {copied ? <Check size={15} className="text-blue-400" /> : <Share2 size={15} />}
          {copied ? "Link copiado" : "Partilhar"}
        </button>
      </div>
    </div>
  );
}
