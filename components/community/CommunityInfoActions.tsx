"use client";

import { useState } from "react";
import { Trash2, LogOut } from "lucide-react";
import { useFadeNav } from "@/components/course/FadeNavContext";

// Sair/eliminar a partir da página de info — mesmas rotas já usadas no chat
// (CommunityChat) e na listagem, só que aqui em botões próprios em vez de
// escondidos no cabeçalho do chat.
export function CommunityInfoActions({ communityId, isOwner }: { communityId: string; isOwner: boolean }) {
  const { fadeNavigate } = useFadeNav();
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    const res = await fetch(`/api/communities/${communityId}/leave`, { method: "POST" });
    setBusy(false);
    if (res.ok) fadeNavigate("/communities");
  }

  async function remove() {
    if (!window.confirm("Eliminar esta comunidade para sempre? Esta ação não pode ser desfeita.")) return;
    setBusy(true);
    const res = await fetch(`/api/communities/${communityId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) fadeNavigate("/communities");
  }

  if (isOwner) {
    return (
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
      >
        <Trash2 size={13} /> Eliminar comunidade
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={leave}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
    >
      <LogOut size={13} /> Sair da comunidade
    </button>
  );
}
