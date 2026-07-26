"use client";

import { useRef, useState } from "react";
import { ThumbsUp, MessageSquare, Trash2, Pencil, Check, X, ChevronDown, Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";

const PAGE_SIZE = 15;
const fieldClass =
  "w-full border-b border-slate-300 bg-transparent pb-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/15 dark:text-white dark:placeholder-slate-500";

export interface CourseCommentData {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string };
  likeCount: number;
  likedByMe: boolean;
  replies: CourseCommentData[];
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

// Versão simplificada de LessonComments.tsx para comentários ao nível do
// CURSO (não da aula) — sem @menções/notificações (não há "participantes da
// aula" numa página pública de curso) nem carrossel de prévia, mas mesma
// mecânica de respostas (1 nível) + likes + editar/eliminar.
function CommentRow({
  comment,
  courseId,
  currentUserId,
  canModerate,
  isReply,
  rootId,
  onChanged,
}: {
  comment: CourseCommentData;
  courseId: string;
  currentUserId: string | null;
  canModerate: boolean;
  isReply: boolean;
  rootId: string;
  onChanged: () => void;
}) {
  const [liked, setLiked] = useState(comment.likedByMe);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplies, setShowReplies] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const [content, setContent] = useState(comment.content);
  const [updatedAt, setUpdatedAt] = useState(comment.updatedAt);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const isEdited = new Date(updatedAt).getTime() - new Date(comment.createdAt).getTime() > 2000;

  function startEdit() {
    setEditText(content);
    setEditError(null);
    setEditing(true);
  }

  async function saveEdit() {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setEditSaving(true);
    setEditError(null);
    const res = await fetch(`/api/courses/${courseId}/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed }),
    });
    setEditSaving(false);
    if (res.ok) {
      const data = await res.json();
      setContent(data.content);
      setUpdatedAt(data.updatedAt);
      setEditing(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setEditError(data.error ?? "Erro ao guardar");
    }
  }

  async function toggleLike() {
    if (!currentUserId) return;
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    const res = await fetch(`/api/courses/${courseId}/comments/${comment.id}/like`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setPosting(true);
    const res = await fetch(`/api/courses/${courseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed, parentId: rootId }),
    });
    setPosting(false);
    if (res.ok) {
      setReplyText("");
      setReplying(false);
      setShowReplies(true);
      onChanged();
    }
  }

  async function handleDelete() {
    if (!confirm("Eliminar este comentário?")) return;
    const res = await fetch(`/api/courses/${courseId}/comments/${comment.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleted(true);
      onChanged();
    }
  }

  if (deleted) return null;
  const canDelete = currentUserId === comment.user.id || canModerate;
  const canEdit = currentUserId === comment.user.id;

  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {initials(comment.user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium text-slate-800 dark:text-slate-100">{comment.user.name}</span>{" "}
          <span className="text-xs text-slate-500">
            {timeAgo(comment.createdAt)}
            {isEdited && " · editado"}
          </span>
        </p>

        {editing ? (
          <div className="mt-1.5">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              rows={2}
              className={fieldClass}
            />
            {editError && <p className="mt-1 text-xs text-red-500">{editError}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={editSaving}
                className="rounded-full px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/5"
              >
                <X size={12} className="mr-1 inline" /> Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving || !editText.trim()}
                className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {editSaving ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : <Check size={12} className="mr-1 inline" />}
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{content}</p>
        )}

        {!editing && (
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
                onClick={() => setReplying((v) => !v)}
                className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <MessageSquare size={13} /> Responder
              </button>
            )}
            {canEdit && (
              <button onClick={startEdit} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300">
                <Pencil size={13} /> Editar
              </button>
            )}
            {canDelete && (
              <button onClick={handleDelete} className="flex items-center gap-1 hover:text-red-400">
                <Trash2 size={13} /> Eliminar
              </button>
            )}
          </div>
        )}

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
              className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
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
                    courseId={courseId}
                    currentUserId={currentUserId}
                    canModerate={canModerate}
                    isReply
                    rootId={rootId}
                    onChanged={onChanged}
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

export function CourseComments({
  courseId,
  comments: initialComments,
  initialTotal,
  initialHasMore,
  currentUserId,
  currentUserName,
  canModerate,
  isAuthenticated,
}: {
  courseId: string;
  comments: CourseCommentData[];
  initialTotal: number;
  initialHasMore: boolean;
  currentUserId: string | null;
  currentUserName: string | null;
  canModerate: boolean;
  isAuthenticated: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const loadedCountRef = useRef(comments.length);

  async function fetchComments() {
    const take = Math.max(loadedCountRef.current, PAGE_SIZE);
    const res = await fetch(`/api/courses/${courseId}/comments?skip=0&take=${take}`);
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments);
      loadedCountRef.current = data.comments.length;
      setTotal(data.total);
      setHasMore(data.hasMore);
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/comments?skip=${comments.length}&take=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => {
          const next = [...prev, ...data.comments];
          loadedCountRef.current = next.length;
          return next;
        });
        setTotal(data.total);
        setHasMore(data.hasMore);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setPosting(true);
    const res = await fetch(`/api/courses/${courseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed }),
    });
    setPosting(false);
    if (res.ok) {
      const created = await res.json();
      setComments((prev) => {
        const next = [{ ...created, likeCount: 0, likedByMe: false, replies: [] }, ...prev];
        loadedCountRef.current = next.length;
        return next;
      });
      setTotal((t) => t + 1);
      setText("");
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
        {total} comentário{total !== 1 ? "s" : ""}
      </h2>

      {isAuthenticated ? (
        <form onSubmit={submitComment} className="mb-6 flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {currentUserName ? initials(currentUserName) : "?"}
          </span>
          <div className="flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Adiciona um comentário..."
              rows={1}
              className={fieldClass}
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

      {comments.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não há comentários neste curso.</p>
      ) : (
        <div className="space-y-5">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              courseId={courseId}
              currentUserId={currentUserId}
              canModerate={canModerate}
              isReply={false}
              rootId={comment.id}
              onChanged={fetchComments}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-5 flex items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {loadingMore && <Loader2 size={14} className="animate-spin" />}
          Carregar mais comentários
        </button>
      )}
    </div>
  );
}
