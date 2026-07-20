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
  initialReaction,
  isAuthenticated,
}: {
  lessonId: string;
  authors: Author[];
  viewCount: number;
  createdAt: string;
  initialLikeCount: number;
  initialReaction: "LIKE" | "DISLIKE" | null;
  isAuthenticated: boolean;
}) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
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
    }
  }

  async function share() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-b border-white/10 pb-4">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-400">
        <span className="font-medium text-slate-200">{authors.map((a) => a.name).join(", ")}</span>
        <span>·</span>
        <span>
          {likeCount} gosto{likeCount !== 1 ? "s" : ""}
        </span>
        <span>·</span>
        <span>
          {viewCount} visualizaç{viewCount !== 1 ? "ões" : "ão"}
        </span>
        <span>·</span>
        <span>{timeAgo(createdAt)}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {primaryAuthor && (
          <Link href={`/instructors/${primaryAuthor.id}`} className="flex shrink-0 items-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {primaryAuthor.name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase())
                .join("")}
            </span>
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
              <ThumbsUp size={15} className={reaction === "LIKE" ? "fill-blue-400" : ""} />
            </button>
            <div className="w-px bg-white/15" />
            <button
              onClick={() => react("DISLIKE")}
              disabled={!isAuthenticated}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed ${
                reaction === "DISLIKE" ? "bg-red-600/20 text-red-400" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <ThumbsDown size={15} className={reaction === "DISLIKE" ? "fill-red-400" : ""} />
            </button>
          </div>

          <button
            onClick={share}
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/5"
          >
            {copied ? <Check size={15} className="text-blue-400" /> : <Share2 size={15} />}
            <span className="hidden sm:inline">{copied ? "Link copiado" : "Partilhar"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
