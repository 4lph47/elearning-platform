"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, UserMinus, Loader2 } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";

type CommunityRole = "OWNER" | "ADMIN" | "MEMBER";

interface Member {
  userId: string;
  role: CommunityRole;
  user: { id: string; name: string; image: string | null; role: "STUDENT" | "INSTRUCTOR" | "ADMIN" };
}

// Lista de membros com moderação (promover/despromover/expulsar) — vive na
// página de info da comunidade (app/communities/[communityId]/info), logo
// abaixo do título/banner, tal como o ecrã de info de um grupo no
// WhatsApp/Telegram. Antes era um painel deslizante sobre o chat; passou a
// fazer parte da própria página para corresponder a esse layout.
export function MembersList({
  communityId,
  currentUserId,
  currentUserRole,
}: {
  communityId: string;
  currentUserId: string;
  currentUserRole: CommunityRole;
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

  if (!members) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={18} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {error && <p className="pb-1 text-xs text-red-500 dark:text-red-400">{error}</p>}
      {members.map((m) => (
        <div key={m.userId} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/5">
          <FadeLink href={`/u/${m.userId}`} className="flex min-w-0 flex-1 items-center gap-2">
            {m.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.user.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {m.user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-900 hover:underline dark:text-white">{m.user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {m.role === "OWNER" ? "Criador" : m.role === "ADMIN" ? "Administrador" : "Membro"}
              </p>
            </div>
          </FadeLink>
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
      ))}
    </div>
  );
}
