"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Send,
  Paperclip,
  ChevronRight,
  Reply,
  Trash2,
  X,
  Loader2,
  Image as ImageIcon,
  FileText,
  Music,
} from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type CommunityRole = "OWNER" | "ADMIN" | "MEMBER";

interface ReplySnippet {
  id: string;
  content: string | null;
  attachmentName: string | null;
  deleted: boolean;
  sender: { id: string; name: string };
}

interface Message {
  id: string;
  content: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  deleted: boolean;
  createdAt: string;
  senderId: string;
  sender: { id: string; name: string; image: string | null };
  replyTo: ReplySnippet | null;
}

const POLL_MS = 4000;

// Menu de anexo estilo WhatsApp — escolhe o tipo primeiro (filtra o picker
// nativo do dispositivo via "accept"), em vez de abrir logo um seletor
// genérico de ficheiros.
const ATTACH_OPTIONS = [
  { label: "Fotos e vídeos", icon: ImageIcon, accept: "image/*,video/*" },
  { label: "Documento", icon: FileText, accept: "" },
  { label: "Áudio", icon: Music, accept: "audio/*" },
];

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function snippetOf(m: { content: string | null; attachmentName: string | null; deleted: boolean }) {
  if (m.deleted) return "Mensagem apagada";
  return m.content || m.attachmentName || "Anexo";
}

function AttachmentPreview({ url, type, name }: { url: string; type: string | null; name: string | null }) {
  if (type?.startsWith("image/")) {
    return (
      <div className="relative mt-1 h-48 w-64 max-w-full overflow-hidden rounded-lg">
        <Image src={url} alt={name ?? ""} fill sizes="256px" className="object-cover" />
      </div>
    );
  }
  if (type?.startsWith("video/")) {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <video src={url} controls className="mt-1 max-h-64 max-w-full rounded-lg" />;
  }
  if (type?.startsWith("audio/")) {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <audio src={url} controls className="mt-1 w-64 max-w-full" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex items-center gap-1.5 underline underline-offset-2"
    >
      <Paperclip size={13} /> {name ?? "Ficheiro"}
    </a>
  );
}

export function CommunityChat({
  communityId,
  communityName,
  coverImageUrl,
  memberCount,
  currentUserId,
  currentUserRole,
  rules,
}: {
  communityId: string;
  communityName: string;
  coverImageUrl: string | null;
  memberCount: number;
  currentUserId: string;
  currentUserRole: CommunityRole;
  rules: string | null;
}) {
  const { fadeNavigate } = useFadeNav();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [dragMessageId, setDragMessageId] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStartXRef = useRef(0);

  useEffect(() => {
    if (!attachMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setAttachMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [attachMenuOpen]);

  function openPicker(accept: string) {
    if (fileInputRef.current) fileInputRef.current.setAttribute("accept", accept);
    setAttachMenuOpen(false);
    fileInputRef.current?.click();
  }

  const SWIPE_MAX = 64;
  const SWIPE_THRESHOLD = 36;

  function dragStart(m: Message) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      if (m.deleted) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStartXRef.current = e.clientX;
      setDragMessageId(m.id);
      setDragX(0);
    };
  }

  function dragMove(m: Message) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragMessageId !== m.id) return;
      const dx = e.clientX - dragStartXRef.current;
      setDragX(Math.max(0, Math.min(dx, SWIPE_MAX)));
    };
  }

  function dragEnd(m: Message) {
    return () => {
      if (dragMessageId !== m.id) return;
      if (dragX > SWIPE_THRESHOLD) setReplyingTo(m);
      setDragMessageId(null);
      setDragX(0);
    };
  }

  async function fetchMessages() {
    const res = await fetch(`/api/communities/${communityId}/messages`);
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
  }, [communityId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  function scrollToMessage(id: string) {
    messageRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1500);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    const replyToId = replyingTo?.id;
    setReplyingTo(null);
    const res = await fetch(`/api/communities/${communityId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, replyToId }),
    });
    setSending(false);
    if (res.ok) {
      const message = await res.json();
      setMessages((prev) => [...prev, message]);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    const replyToId = replyingTo?.id;
    try {
      const signRes = await fetch("/api/upload/community-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
      });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error ?? "Erro ao preparar envio");

      const { error: uploadError } = await getSupabaseBrowserClient()
        .storage.from(signData.bucket)
        .uploadToSignedUrl(signData.path, signData.token, file, { contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      const res = await fetch(`/api/communities/${communityId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentUrl: signData.publicUrl, attachmentType: file.type, attachmentName: file.name, replyToId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao enviar ficheiro");
      }
      const message = await res.json();
      setMessages((prev) => [...prev, message]);
      setReplyingTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar ficheiro");
    } finally {
      setUploading(false);
    }
  }

  async function deleteMessage(id: string) {
    const res = await fetch(`/api/communities/${communityId}/messages/${id}`, { method: "DELETE" });
    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
    }
  }

  async function leaveCommunity() {
    setLeaving(true);
    const res = await fetch(`/api/communities/${communityId}/leave`, { method: "POST" });
    setLeaving(false);
    if (res.ok) fadeNavigate("/communities");
  }

  const canDelete = (m: Message) => m.senderId === currentUserId || currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-white dark:bg-black">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-white/10">
        <FadeLink
          href="/communities"
          aria-label="Voltar às comunidades"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <ArrowLeft size={18} />
        </FadeLink>

        {/* Clicar na parte de cima (avatar+nome) abre a página de info da
            comunidade — banner, descrição, regras e a lista de membros logo
            abaixo do título, tal como o ecrã de info de um grupo no
            WhatsApp/Telegram. */}
        <button
          type="button"
          onClick={() => fadeNavigate(`/communities/${communityId}/info`)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left hover:bg-slate-50 dark:hover:bg-white/5"
        >
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {communityName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{communityName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {memberCount} membro{memberCount !== 1 ? "s" : ""}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-400" />
        </button>

        {currentUserRole !== "OWNER" && (
          <button
            type="button"
            onClick={leaveCommunity}
            disabled={leaving}
            className="shrink-0 text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
          >
            {leaving ? "A sair..." : "Sair"}
          </button>
        )}
      </div>

      {rules && (
        <details className="border-b border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
          <summary className="cursor-pointer font-medium">Regras da comunidade</summary>
          <p className="mt-1 whitespace-pre-wrap">{rules}</p>
        </details>
      )}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-slate-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Ainda não há mensagens. Diz olá à comunidade.
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === currentUserId;
            const highlighted = highlightId === m.id;
            const isDragging = dragMessageId === m.id;

            // Ações (responder/apagar) — só visíveis ao passar o rato, no
            // lado de dentro da bolha (perto do centro do ecrã): à esquerda
            // das tuas mensagens (alinhadas à direita), à direita das dos
            // outros (alinhadas à esquerda).
            const actions = (
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                {!m.deleted && (
                  <button
                    type="button"
                    onClick={() => setReplyingTo(m)}
                    aria-label="Responder"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
                  >
                    <Reply size={13} />
                  </button>
                )}
                {!m.deleted && canDelete(m) && (
                  <button
                    type="button"
                    onClick={() => deleteMessage(m.id)}
                    aria-label="Apagar"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );

            const bubbleColumn = (
              <div className="relative flex max-w-[80%] flex-col">
                {/* Ícone de responder revelado ao arrastar a mensagem para a
                    direita (drag-to-reply, igual ao WhatsApp/Telegram). */}
                <div
                  className="pointer-events-none absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 pr-2 text-blue-500 transition-opacity"
                  style={{ opacity: isDragging ? Math.min(dragX / SWIPE_THRESHOLD, 1) : 0 }}
                >
                  <Reply size={16} />
                </div>
                <div
                  onPointerDown={dragStart(m)}
                  onPointerMove={dragMove(m)}
                  onPointerUp={dragEnd(m)}
                  onPointerCancel={dragEnd(m)}
                  style={{ transform: `translateX(${isDragging ? dragX : 0}px)`, touchAction: "pan-y" }}
                  className={`flex flex-col ${isDragging ? "" : "transition-transform"} ${isMine ? "items-end" : "items-start"}`}
                >
                  {!isMine && (
                    <p className="mb-0.5 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">{m.sender.name}</p>
                  )}
                  <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm transition-shadow ${
                      m.deleted
                        ? "italic text-slate-400 dark:text-slate-500"
                        : isMine
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white"
                    } ${m.deleted ? (isMine ? "bg-blue-600/40" : "bg-slate-100 dark:bg-white/5") : ""} ${
                      highlighted ? "ring-2 ring-amber-400" : ""
                    }`}
                  >
                    {m.replyTo && (
                      <button
                        type="button"
                        onClick={() => scrollToMessage(m.replyTo!.id)}
                        className={`mb-1 block w-full rounded border-l-2 px-2 py-1 text-left text-xs ${
                          isMine
                            ? "border-white/50 bg-black/10 text-white/90"
                            : "border-slate-400 bg-black/5 text-slate-600 dark:border-white/30 dark:bg-white/10 dark:text-slate-300"
                        }`}
                      >
                        <p className="truncate font-medium">{m.replyTo.sender.name}</p>
                        <p className="truncate opacity-80">{snippetOf(m.replyTo)}</p>
                      </button>
                    )}
                    {m.deleted ? (
                      "Mensagem apagada"
                    ) : (
                      <>
                        {m.content}
                        {m.attachmentUrl && (
                          <AttachmentPreview url={m.attachmentUrl} type={m.attachmentType} name={m.attachmentName} />
                        )}
                      </>
                    )}
                  </div>
                  <span className="mt-0.5 px-1 text-[10px] text-slate-400 dark:text-slate-500">{timeLabel(m.createdAt)}</span>
                </div>
              </div>
            );

            return (
              <div
                key={m.id}
                ref={(el) => {
                  messageRefs.current[m.id] = el;
                }}
                className={`group flex items-center gap-1.5 ${isMine ? "justify-end" : "justify-start"}`}
              >
                {isMine ? (
                  <>
                    {actions}
                    {bubbleColumn}
                  </>
                ) : (
                  <>
                    {bubbleColumn}
                    {actions}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {error && <p className="px-3 pb-1 text-xs text-red-500 dark:text-red-400">{error}</p>}

      {replyingTo && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
          <div className="min-w-0 border-l-2 border-blue-500 pl-2">
            <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">A responder a {replyingTo.sender.name}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{snippetOf(replyingTo)}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            aria-label="Cancelar resposta"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Menu de anexo — escolhe o tipo primeiro, tal como o WhatsApp, antes
          de abrir o seletor de ficheiros nativo do dispositivo. */}
      {attachMenuOpen && (
        <div
          ref={attachMenuRef}
          className="grid grid-cols-3 gap-2 border-t border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900"
        >
          {ATTACH_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => openPicker(opt.accept)}
                className="flex flex-col items-center gap-1.5 rounded-lg p-2 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Icon size={20} />
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-200 p-2 dark:border-white/10">
        <input ref={fileInputRef} type="file" onChange={handleFile} className="hidden" />
        <button
          type="button"
          onClick={() => setAttachMenuOpen((v) => !v)}
          disabled={uploading}
          aria-label="Anexar ficheiro"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10 ${
            attachMenuOpen ? "bg-slate-100 text-blue-600 dark:bg-white/10 dark:text-blue-400" : "text-slate-500 dark:text-slate-300"
          }`}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
        </button>
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
