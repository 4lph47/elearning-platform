"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Send, Paperclip, Users, X, Loader2, ShieldCheck, ShieldOff, UserMinus } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type CommunityRole = "OWNER" | "ADMIN" | "MEMBER";

interface Message {
  id: string;
  content: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  createdAt: string;
  senderId: string;
  sender: { id: string; name: string; image: string | null };
}

interface Member {
  userId: string;
  role: CommunityRole;
  user: { id: string; name: string; image: string | null; role: "STUDENT" | "INSTRUCTOR" | "ADMIN" };
}

const POLL_MS = 4000;

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

function MembersPanel({
  communityId,
  currentUserId,
  currentUserRole,
  onClose,
}: {
  communityId: string;
  currentUserId: string;
  currentUserRole: CommunityRole;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/communities/${communityId}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  const canActOn = (m: Member) => {
    if (m.role === "OWNER" || m.userId === currentUserId) return false;
    if (m.role === "ADMIN" && currentUserRole !== "OWNER") return false;
    return currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  };

  async function setRole(userId: string, role: "ADMIN" | "MEMBER") {
    setError(null);
    setBusyUserId(userId);
    const res = await fetch(`/api/communities/${communityId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusyUserId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao alterar membro");
      return;
    }
    load();
  }

  async function kick(userId: string) {
    setError(null);
    setBusyUserId(userId);
    const res = await fetch(`/api/communities/${communityId}/members/${userId}`, { method: "DELETE" });
    setBusyUserId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao remover membro");
      return;
    }
    load();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-80 max-w-[85vw] flex-col bg-white shadow-2xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <p className="font-semibold text-slate-900 dark:text-white">Membros</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
        {error && <p className="px-4 pt-2 text-xs text-red-500 dark:text-red-400">{error}</p>}
        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {!members ? (
            <div className="flex justify-center py-6">
              <Loader2 size={18} className="animate-spin text-slate-400" />
            </div>
          ) : (
            members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5">
                {m.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.user.image} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {m.user.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-900 dark:text-white">{m.user.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {m.role === "OWNER" ? "Criador" : m.role === "ADMIN" ? "Administrador" : "Membro"}
                  </p>
                </div>
                {canActOn(m) && (
                  <div className="flex shrink-0 items-center gap-1">
                    {busyUserId === m.userId ? (
                      <Loader2 size={14} className="animate-spin text-slate-400" />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setRole(m.userId, m.role === "ADMIN" ? "MEMBER" : "ADMIN")}
                          aria-label={m.role === "ADMIN" ? "Despromover" : "Promover a admin"}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                        >
                          {m.role === "ADMIN" ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => kick(m.userId)}
                          aria-label="Remover"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <UserMinus size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
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
  const [membersOpen, setMembersOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    const res = await fetch(`/api/communities/${communityId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
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
        body: JSON.stringify({ attachmentUrl: signData.publicUrl, attachmentType: file.type, attachmentName: file.name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao enviar ficheiro");
      }
      const message = await res.json();
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar ficheiro");
    } finally {
      setUploading(false);
    }
  }

  async function leaveCommunity() {
    setLeaving(true);
    const res = await fetch(`/api/communities/${communityId}/leave`, { method: "POST" });
    setLeaving(false);
    if (res.ok) fadeNavigate("/communities");
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-white dark:bg-black">
      <div className="flex items-center gap-3 border-b border-slate-200 px-3 py-2.5 dark:border-white/10">
        <FadeLink
          href="/communities"
          aria-label="Voltar às comunidades"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <ArrowLeft size={18} />
        </FadeLink>
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
        <button
          type="button"
          onClick={() => setMembersOpen(true)}
          aria-label="Ver membros"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <Users size={17} />
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
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${isMine ? "items-end" : "items-start"} flex flex-col`}>
                  {!isMine && (
                    <p className="mb-0.5 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">{m.sender.name}</p>
                  )}
                  <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
                      isMine ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white"
                    }`}
                  >
                    {m.content}
                    {m.attachmentUrl && (
                      <AttachmentPreview url={m.attachmentUrl} type={m.attachmentType} name={m.attachmentName} />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && <p className="px-3 pb-1 text-xs text-red-500 dark:text-red-400">{error}</p>}

      <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-200 p-2 dark:border-white/10">
        <input ref={fileInputRef} type="file" onChange={handleFile} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Anexar ficheiro"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10"
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

      {membersOpen && (
        <MembersPanel
          communityId={communityId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onClose={() => setMembersOpen(false)}
        />
      )}
    </div>
  );
}
