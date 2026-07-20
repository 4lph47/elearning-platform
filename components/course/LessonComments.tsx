"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, MessageSquare, Trash2, ChevronDown } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";

export interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
  likeCount: number;
  likedByMe: boolean;
  replies: CommentData[];
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function CommentRow({
  comment,
  lessonId,
  currentUserId,
  canModerate,
  isReply,
  rootId,
  onReplyPosted,
}: {
  comment: CommentData;
  lessonId: string;
  currentUserId: string | null;
  canModerate: boolean;
  isReply: boolean;
  rootId: string;
  onReplyPosted: () => void;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(comment.likedByMe);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplies, setShowReplies] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function toggleLike() {
    if (!currentUserId) return;
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    const res = await fetch(`/api/lessons/${lessonId}/comments/${comment.id}/like`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/lessons/${lessonId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: replyText, parentId: rootId }),
    });
    setPosting(false);
    if (res.ok) {
      setReplyText("");
      setReplying(false);
      setShowReplies(true);
      onReplyPosted();
    }
  }

  async function handleDelete() {
    if (!confirm("Eliminar este comentário?")) return;
    const res = await fetch(`/api/lessons/${lessonId}/comments/${comment.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleted(true);
      router.refresh();
    }
  }

  if (deleted) return null;
  const canDelete = currentUserId === comment.user.id || canModerate;

  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {initials(comment.user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium text-slate-800 dark:text-slate-100">{comment.user.name}</span>{" "}
          <span className="text-xs text-slate-500">{timeAgo(comment.createdAt)}</span>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{comment.content}</p>

        <div className="mt-1.5 flex items-center gap-4 text-xs text-slate-500">
          <button
            onClick={toggleLike}
            disabled={!currentUserId}
            className={`flex items-center gap-1 hover:text-slate-700 disabled:cursor-not-allowed dark:hover:text-slate-300 ${liked ? "text-blue-400" : ""}`}
          >
            <ThumbsUp size={13} className={liked ? "fill-blue-400" : ""} /> {likeCount > 0 ? likeCount : ""}
          </button>
          {currentUserId && (
            <button
              onClick={() => {
                setReplying((v) => !v);
                if (!replying && isReply) setReplyText(`@${comment.user.name} `);
              }}
              className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <MessageSquare size={13} /> Responder
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="flex items-center gap-1 hover:text-red-400">
              <Trash2 size={13} /> Eliminar
            </button>
          )}
        </div>

        {replying && (
          <form onSubmit={submitReply} className="mt-2 flex gap-2">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Escreve uma resposta..."
              autoFocus
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
            />
            <button
              type="submit"
              disabled={posting || !replyText.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Responder
            </button>
          </form>
        )}

        {!isReply && comment.replies.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowReplies((v) => !v)}
              className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              <ChevronDown size={14} className={`transition-transform ${showReplies ? "rotate-180" : ""}`} />
              {comment.replies.length} resposta{comment.replies.length !== 1 ? "s" : ""}
            </button>
            {showReplies && (
              <div className="mt-3 space-y-3 border-l border-slate-200 pl-4 dark:border-white/10">
                {comment.replies.map((reply) => (
                  <CommentRow
                    key={reply.id}
                    comment={reply}
                    lessonId={lessonId}
                    currentUserId={currentUserId}
                    canModerate={canModerate}
                    isReply
                    rootId={rootId}
                    onReplyPosted={onReplyPosted}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function LessonComments({
  lessonId,
  comments: initialComments,
  currentUserId,
  currentUserName,
  canModerate,
  isAuthenticated,
}: {
  lessonId: string;
  comments: CommentData[];
  currentUserId: string | null;
  currentUserName: string | null;
  canModerate: boolean;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [sort, setSort] = useState<"top" | "recent">("recent");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const totalCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);
  const sorted = [...comments].sort((a, b) =>
    sort === "top"
      ? b.likeCount - a.likeCount
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );


  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/lessons/${lessonId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    setPosting(false);
    if (res.ok) {
      const created = await res.json();
      setComments((prev) => [{ ...created, likeCount: 0, likedByMe: false, replies: [] }, ...prev]);
      setText("");
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center gap-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{totalCount} comentário{totalCount !== 1 ? "s" : ""}</h2>
        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
          <button
            onClick={() => setSort("recent")}
            className={`rounded-full px-3 py-1 ${
              sort === "recent"
                ? "bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                : "hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Recentes
          </button>
          <button
            onClick={() => setSort("top")}
            className={`rounded-full px-3 py-1 ${
              sort === "top"
                ? "bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white"
                : "hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Relevantes
          </button>
        </div>
      </div>

      {isAuthenticated ? (
        <form onSubmit={submitComment} className="mb-6 flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {currentUserName ? initials(currentUserName) : "?"}
          </span>
          <div className="flex-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Adiciona um comentário..."
              className="w-full border-b border-slate-300 bg-transparent pb-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/15 dark:text-white dark:placeholder-slate-500"
            />
            {text && (
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setText("")}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={posting}
                  className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  Comentar
                </button>
              </div>
            )}
          </div>
        </form>
      ) : (
        <p className="mb-6 text-sm text-slate-500">Inicia sessão para comentar.</p>
      )}

      <div className="space-y-5">
        {sorted.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            lessonId={lessonId}
            currentUserId={currentUserId}
            canModerate={canModerate}
            isReply={false}
            rootId={comment.id}
            onReplyPosted={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}
