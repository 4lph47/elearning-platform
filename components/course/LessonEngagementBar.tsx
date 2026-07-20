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
  const [showDetails, setShowDetails] = useState(false);
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

  return (
    <div className="border-b border-white/10 pb-4">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-400">
        <span className="font-medium text-slate-200">{authors.map((a) => a.name).join(", ")}</span>
        <span>·</span>
        <span>
          {viewCount} visualizaç{viewCount !== 1 ? "ões" : "ão"}
        </span>
        <span>·</span>
        <span>{timeAgo(createdAt)}</span>
        <button onClick={() => setShowDetails((v) => !v)} className="font-medium text-slate-200 hover:text-white">
          {showDetails ? "menos" : "...mais"}
        </button>
      </div>

      {showDetails && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-semibold text-white">Detalhes do vídeo</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Data</dt>
              <dd className="text-slate-200">
                {new Date(createdAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Visualizações</dt>
              <dd className="text-slate-200">{viewCount.toLocaleString("pt-PT")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Gostos</dt>
              <dd className="text-slate-200">{likeCount.toLocaleString("pt-PT")}</dd>
            </div>
          </dl>
        </div>
      )}

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

          <button onClick={share} className="text-slate-300 hover:text-white" aria-label="Partilhar">
            {copied ? <Check size={19} className="text-blue-400" /> : <Share2 size={19} />}
          </button>
        </div>
      </div>
    </div>
  );
}
