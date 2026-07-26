"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { timeAgo } from "@/lib/timeAgo";
import { decodeMentionContent } from "@/lib/mentions";

interface NotificationItem {
  id: string;
  type: "MENTION" | "RESALE_COMMISSION_CHANGE" | "COMMENT_REPLY" | "DIRECT_MESSAGE";
  read: boolean;
  createdAt: string;
  actor: { id: string; name: string };
  comment: { content: string } | null;
  courseSlug: string | null;
  lessonId: string | null;
  resaleCourseTitle: string | null;
  resaleOldCommission: number | null;
  resaleNewCommission: number | null;
  resaleOldPrice: number | null;
  resaleNewPrice: number | null;
}

const POLL_MS = 30000;

// Menções apontam para a aula do comentário; mudanças de comissão de revenda
// apontam para a página de gestão de revendas do próprio (app/dashboard/resale
// ou app/instructor/resale, conforme o papel de quem recebeu a notificação).
export function NotificationBell() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

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

  if (status !== "authenticated") return null;

  function notificationHref(n: NotificationItem) {
    if (n.type === "MENTION" || n.type === "COMMENT_REPLY") return `/courses/${n.courseSlug}/lessons/${n.lessonId}`;
    if (n.type === "DIRECT_MESSAGE") return `/u/${n.actor.id}`;
    return session?.user.role === "STUDENT" ? "/dashboard/resale" : "/instructor/resale";
  }

  function commissionText(n: NotificationItem) {
    return n.resaleNewPrice !== null
      ? `Preço da tua listagem de "${n.resaleCourseTitle}" ajustado de ${n.resaleOldPrice?.toFixed(2)}€ para ${n.resaleNewPrice.toFixed(2)}€ (comissão subiu para ${n.resaleNewCommission?.toFixed(2)}€)`
      : `Comissão subiu para ${n.resaleNewCommission?.toFixed(2)}€ em "${n.resaleCourseTitle}" — a tua parte por venda desceu, ajusta o preço se quiseres compensar`;
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-white/10 dark:bg-neutral-900">
          <div className="flex items-center justify-between px-3 py-1.5">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Notificações</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-blue-500 hover:underline">
                Marcar tudo como lido
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">Sem notificações.</p>
            ) : (
              items.map((n) => (
                <FadeLink
                  key={n.id}
                  href={notificationHref(n)}
                  onClick={() => {
                    setOpen(false);
                    if (!n.read) markRead(n.id);
                  }}
                  className={`block px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 ${
                    n.read ? "" : "bg-blue-50 dark:bg-blue-500/10"
                  }`}
                >
                  {n.type === "MENTION" || n.type === "COMMENT_REPLY" ? (
                    <>
                      <p className="text-slate-700 dark:text-slate-200">
                        <span className="font-medium text-slate-900 dark:text-white">{n.actor.name}</span>{" "}
                        {n.type === "MENTION" ? "mencionou-te num comentário" : "respondeu ao teu comentário"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {n.comment ? decodeMentionContent(n.comment.content).display : ""}
                      </p>
                    </>
                  ) : n.type === "DIRECT_MESSAGE" ? (
                    <p className="text-slate-700 dark:text-slate-200">
                      <span className="font-medium text-slate-900 dark:text-white">{n.actor.name}</span> enviou-te uma
                      mensagem
                    </p>
                  ) : (
                    <p className="text-slate-700 dark:text-slate-200">{commissionText(n)}</p>
                  )}
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{timeAgo(n.createdAt)}</p>
                </FadeLink>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
