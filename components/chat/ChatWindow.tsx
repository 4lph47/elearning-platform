"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Send, X, Loader2 } from "lucide-react";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
}

const POLL_MS = 4000;

// Painel de chat 1:1 — sem WebSocket nenhum, só polling (mesma técnica do
// NotificationBell), suficiente para uma conversa entre duas pessoas que não
// precisa de latência de milissegundos.
export function ChatWindow({
  otherUserId,
  otherUserName,
  otherUserImage,
  onClose,
}: {
  otherUserId: string;
  otherUserName: string;
  otherUserImage: string | null;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  async function fetchMessages() {
    const res = await fetch(`/api/messages/${otherUserId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  useEffect(() => {
    if (!shouldScrollRef.current || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: otherUserId, content }),
    });
    setSending(false);
    if (res.ok) {
      const message = await res.json();
      setMessages((prev) => [...prev, message]);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex h-[28rem] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-white/10">
        {otherUserImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={otherUserImage} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {otherUserName.charAt(0).toUpperCase()}
          </span>
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{otherUserName}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          <X size={16} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Ainda não há mensagens. Diz olá a {otherUserName.split(" ")[0]}.
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === session?.user.id;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <span
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                    isMine
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white"
                  }`}
                >
                  {m.content}
                </span>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-200 p-2 dark:border-white/10">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreve uma mensagem..."
          className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          aria-label="Enviar"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
