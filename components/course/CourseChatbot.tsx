"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function CourseChatbot({
  courseId,
  lessonId,
  courseTitle,
  open,
  onOpenChange,
}: {
  courseId: string;
  lessonId: string;
  courseTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rendered, setRendered] = useState(open);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    const timeout = setTimeout(() => setRendered(false), 150);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setError(null);
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, lessonId, messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao contactar o assistente");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao contactar o assistente");
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => onOpenChange(true)}
        className={`fixed right-6 top-20 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all duration-150 hover:bg-blue-500 ${
          open ? "pointer-events-none scale-90 opacity-0" : "scale-100 opacity-100"
        }`}
        aria-label="Abrir assistente do curso"
      >
        <MessageCircle size={18} />
      </button>

      {rendered && (
        <div
          className={`fixed right-6 top-20 z-40 flex h-[calc(100vh-6.5rem)] w-[400px] max-w-[calc(100vw-3rem)] flex-col rounded-2xl border border-white/10 bg-slate-950 shadow-xl transition-all duration-150 ease-out ${
            open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="line-clamp-1 text-sm font-medium text-white">{courseTitle}</p>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Fechar assistente"
            >
              <X size={14} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm ${
                  m.role === "user" ? "ml-auto bg-blue-600 text-white" : "bg-slate-800 text-slate-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content || (loading && i === messages.length - 1 ? "…" : "")}</p>
              </div>
            ))}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-white/10 p-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunta algo sobre este curso."
              disabled={loading}
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
