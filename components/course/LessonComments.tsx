"use client";

import { useEffect, useRef, useState } from "react";
import { ThumbsUp, MessageSquare, Trash2, ChevronDown, Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/timeAgo";

const PAGE_SIZE = 15;

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

function CommentPreviewRow({ comment }: { comment: CommentData }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {initials(comment.user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium text-slate-800 dark:text-slate-100">{comment.user.name}</span>{" "}
          <span className="text-xs text-slate-500">{timeAgo(comment.createdAt)}</span>
        </p>
        <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">{comment.content}</p>
      </div>
      {comment.likeCount > 0 && (
        <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
          <ThumbsUp size={12} className="fill-blue-400 text-blue-400" /> {comment.likeCount}
        </span>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  lessonId,
  currentUserId,
  canModerate,
  isReply,
  rootId,
  onChanged,
}: {
  comment: CommentData;
  lessonId: string;
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
  const replyBoxRef = useRef<HTMLFormElement>(null);
  const replyToggleRef = useRef<HTMLButtonElement>(null);

  // Clique fora da caixa de resposta fecha-a sozinha — não precisa de
  // clicar em "Responder" outra vez pra tirá-la da frente. O próprio botão
  // "Responder" fica de fora da deteção (senão o próprio clique nele pra
  // fechar a caixa disparava o "clique fora" primeiro e reabria-a logo a
  // seguir, via mousedown antes do click).
  useEffect(() => {
    if (!replying) return;
    function onOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      if (replyBoxRef.current?.contains(target)) return;
      if (replyToggleRef.current?.contains(target)) return;
      setReplying(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [replying]);

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
      onChanged();
    }
  }

  async function handleDelete() {
    if (!confirm("Eliminar este comentário?")) return;
    const res = await fetch(`/api/lessons/${lessonId}/comments/${comment.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleted(true);
      onChanged();
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
              ref={replyToggleRef}
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
          <form ref={replyBoxRef} onSubmit={submitReply} className="mt-2 flex gap-2">
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

const CAROUSEL_INTERVAL_MS = 3500;
const CAROUSEL_TRANSITION_MS = 300;

export function LessonComments({
  lessonId,
  comments: initialComments,
  initialTopComments,
  initialTotal,
  initialHasMore,
  currentUserId,
  currentUserName,
  canModerate,
  isAuthenticated,
}: {
  lessonId: string;
  comments: CommentData[];
  initialTopComments: CommentData[];
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
  const [sort, setSort] = useState<"top" | "recent">("recent");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const fetchingRef = useRef(false);

  // Carrossel fechado: 1 comentário de cada vez, entre os N mais gostados,
  // esmorecendo/deslizando pra cima na troca — expande para a lista
  // completa só quando a pessoa toca na secção.
  const [expanded, setExpanded] = useState(false);
  const [topComments] = useState(initialTopComments);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselPhase, setCarouselPhase] = useState<"idle" | "leaving" | "entering">("idle");

  useEffect(() => {
    if (expanded || topComments.length <= 1) return;
    const cycle = setInterval(() => setCarouselPhase("leaving"), CAROUSEL_INTERVAL_MS);
    return () => clearInterval(cycle);
  }, [expanded, topComments.length]);

  useEffect(() => {
    if (carouselPhase !== "leaving") return;
    const t = setTimeout(() => {
      setCarouselIndex((i) => (i + 1) % topComments.length);
      setCarouselPhase("entering");
    }, CAROUSEL_TRANSITION_MS);
    return () => clearTimeout(t);
  }, [carouselPhase, topComments.length]);

  useEffect(() => {
    if (carouselPhase !== "entering") return;
    // Duplo rAF: garante que o browser pinta a posição inicial (abaixo,
    // invisível) antes de assentar — senão a transição não anima, salta
    // logo pro valor final (mesmo truque do useSwipeNav.ts).
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setCarouselPhase("idle"));
    });
    return () => cancelAnimationFrame(frame);
  }, [carouselPhase]);
  // O poll (setInterval) só é montado uma vez — sem isto, ele fecharia
  // sempre sobre o `comments` da 1ª renderização (array vazio/inicial) em
  // vez do que a pessoa já carregou com "Carregar mais".
  const loadedCountRef = useRef(comments.length);
  useEffect(() => {
    loadedCountRef.current = comments.length;
  }, [comments.length]);

  const sorted = [...comments].sort((a, b) =>
    sort === "top"
      ? b.likeCount - a.likeCount
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Refresca só a janela já carregada (não a aula inteira) — quem só viu os
  // primeiros 15 continua só a pedir 15 a cada poll, mesmo que a aula tenha
  // milhares de comentários no total.
  async function fetchComments() {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const take = Math.max(loadedCountRef.current, PAGE_SIZE);
      const res = await fetch(`/api/lessons/${lessonId}/comments?skip=0&take=${take}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
        setTotal(data.total);
        setHasMore(data.hasMore);
      }
    } finally {
      fetchingRef.current = false;
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}/comments?skip=${comments.length}&take=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, ...data.comments]);
        setTotal(data.total);
        setHasMore(data.hasMore);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const interval = setInterval(fetchComments, 8000);
    const onFocus = () => fetchComments();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

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
      setTotal((t) => t + 1);
      setText("");
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center gap-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{total} comentário{total !== 1 ? "s" : ""}</h2>
        {expanded && (
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
        )}
      </div>

      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="block w-full overflow-hidden rounded-xl bg-slate-100 px-4 py-4 text-left dark:bg-white/5"
        >
          {topComments.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isAuthenticated ? "Sê o primeiro a comentar." : "Ver comentários"}
            </p>
          ) : (
            <div
              key={topComments[carouselIndex]?.id}
              className={
                carouselPhase === "leaving"
                  ? "-translate-y-3 opacity-0 transition-all duration-300 ease-in"
                  : carouselPhase === "entering"
                  ? "translate-y-3 opacity-0"
                  : "translate-y-0 opacity-100 transition-all duration-300 ease-out"
              }
            >
              <CommentPreviewRow comment={topComments[carouselIndex]} />
            </div>
          )}
        </button>
      )}

      {expanded && (
      <>
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
            onChanged={fetchComments}
          />
        ))}
      </div>

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
      </>
      )}
    </div>
  );
}
