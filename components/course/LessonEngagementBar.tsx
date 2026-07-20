"use client";

import { useState, type ReactNode } from "react";
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
  completeButton,
}: {
  lessonId: string;
  authors: Author[];
  viewCount: number;
  createdAt: string;
  initialLikeCount: number;
  initialReaction: "LIKE" | "DISLIKE" | null;
  isAuthenticated: boolean;
  completeButton?: ReactNode;
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
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
      } catch {
        // utilizador cancelou a partilha
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const avatar = (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
      {primaryAuthor?.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")}
    </span>
  );

  const meta = (
    <>
      <span className="font-medium text-slate-200">{authors.map((a) => a.name).join(", ")}</span>
      <span>·</span>
      <span>
        {viewCount} visualizaç{viewCount !== 1 ? "ões" : "ão"}
      </span>
      <span>·</span>
      <span>{timeAgo(createdAt)}</span>
    </>
  );

  const actions = (
    <div className="flex items-center gap-5">
      {completeButton}

      <button
        onClick={() => react("LIKE")}
        disabled={!isAuthenticated}
        className={`flex items-center gap-1.5 text-sm font-medium disabled:cursor-not-allowed ${
          reaction === "LIKE" ? "text-blue-400" : "text-slate-300 hover:text-white"
        }`}
      >
        <ThumbsUp size={19} className={reaction === "LIKE" ? "fill-blue-400" : ""} />
        {likeCount}
      </button>

      <button
        onClick={() => react("DISLIKE")}
        disabled={!isAuthenticated}
        className={`disabled:cursor-not-allowed ${
          reaction === "DISLIKE" ? "text-red-400" : "text-slate-300 hover:text-white"
        }`}
      >
        <ThumbsDown size={19} className={reaction === "DISLIKE" ? "fill-red-400" : ""} />
      </button>

      <button onClick={share} className="text-white" aria-label="Partilhar">
        {copied ? <Check size={19} className="text-blue-400" /> : <Share2 size={19} />}
      </button>
    </div>
  );

  return (
    <div className="pb-4">
      {/* Mobile: linha meta em cima, avatar+ações por baixo. */}
      <div className="lg:hidden">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-400">{meta}</div>
        <div className="mt-3 flex items-center justify-between gap-3">
          {primaryAuthor && (
            <Link href={`/instructors/${primaryAuthor.id}`} className="flex shrink-0 items-center">
              {avatar}
            </Link>
          )}
          {actions}
        </div>
      </div>

      {/* Desktop: avatar + meta juntos numa linha, ações à direita. */}
      <div className="hidden lg:flex lg:items-center lg:justify-between lg:gap-3">
        {primaryAuthor && (
          <Link href={`/instructors/${primaryAuthor.id}`} className="flex min-w-0 items-center gap-2.5">
            {avatar}
            <span className="flex flex-wrap items-center gap-x-1.5 truncate text-sm text-slate-400">{meta}</span>
          </Link>
        )}
        {actions}
      </div>
    </div>
  );
}
