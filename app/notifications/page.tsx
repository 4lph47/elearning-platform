"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, Loader2 } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { timeAgo } from "@/lib/timeAgo";
import { decodeMentionContent } from "@/lib/mentions";

const PAGE_SIZE = 20;

interface NotificationItem {
  id: string;
  type: "MENTION" | "RESALE_COMMISSION_CHANGE" | "COMMENT_REPLY";
  read: boolean;
  createdAt: string;
  actor: { id: string; name: string; image: string | null };
  comment: { content: string } | null;
  courseSlug: string | null;
  lessonId: string | null;
  resaleCourseTitle: string | null;
  resaleOldCommission: number | null;
  resaleNewCommission: number | null;
  resaleOldPrice: number | null;
  resaleNewPrice: number | null;
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

// Vista completa (a campainha da Navbar só mostra as últimas 20 num
// dropdown) — mesma API, com paginação e "marcar tudo como lido".
export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      const res = await fetch(`/api/notifications?take=${PAGE_SIZE}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications);
        setUnreadCount(data.unreadCount);
        setHasMore(data.hasMore);
      }
      setLoading(false);
    })();
  }, [status]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const res = await fetch(`/api/notifications?skip=${items.length}&take=${PAGE_SIZE}`);
    if (res.ok) {
      const data = await res.json();
      setItems((prev) => [...prev, ...data.notifications]);
      setHasMore(data.hasMore);
    }
    setLoadingMore(false);
  }

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "POST" });
  }

  function notificationHref(n: NotificationItem) {
    if (n.type === "MENTION" || n.type === "COMMENT_REPLY") return `/courses/${n.courseSlug}/lessons/${n.lessonId}`;
    return session?.user.role === "STUDENT" ? "/dashboard/resale" : "/instructor/resale";
  }

  function commissionText(n: NotificationItem) {
    return n.resaleNewPrice !== null
      ? `Preço da tua listagem de "${n.resaleCourseTitle}" ajustado de ${n.resaleOldPrice?.toFixed(2)}€ para ${n.resaleNewPrice.toFixed(2)}€ (comissão subiu para ${n.resaleNewCommission?.toFixed(2)}€)`
      : `Comissão subiu para ${n.resaleNewCommission?.toFixed(2)}€ em "${n.resaleCourseTitle}" — a tua parte por venda desceu, ajusta o preço se quiseres compensar`;
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-8">
        <p className="text-slate-500 dark:text-slate-400">Inicia sessão para ver as tuas notificações.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900 dark:text-white">
          <Bell size={20} /> Notificações
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm font-medium text-blue-500 hover:underline">
            Marcar tudo como lido
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400">Ainda não tens notificações.</p>
      ) : (
        <div className="space-y-1">
          {items.map((n) => (
            <FadeLink
              key={n.id}
              href={notificationHref(n)}
              onClick={() => {
                if (!n.read) markRead(n.id);
              }}
              className={`flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-slate-50 dark:hover:bg-white/5 ${
                n.read ? "" : "bg-blue-50 dark:bg-blue-500/10"
              }`}
            >
              {n.actor.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.actor.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {initials(n.actor.name)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {n.type === "MENTION" || n.type === "COMMENT_REPLY" ? (
                  <>
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      <span className="font-medium text-slate-900 dark:text-white">{n.actor.name}</span>{" "}
                      {n.type === "MENTION" ? "mencionou-te num comentário" : "respondeu ao teu comentário"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {n.comment ? decodeMentionContent(n.comment.content).display : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-700 dark:text-slate-200">{commissionText(n)}</p>
                )}
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden />}
            </FadeLink>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-5 flex items-center gap-2 text-sm font-medium text-blue-500 hover:underline disabled:opacity-50"
        >
          {loadingMore && <Loader2 size={14} className="animate-spin" />}
          Carregar mais
        </button>
      )}
    </div>
  );
}
