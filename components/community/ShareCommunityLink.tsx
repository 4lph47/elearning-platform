"use client";

import { useState } from "react";
import { Share2, Check, Link2 } from "lucide-react";

// Partilhar o link de convite da comunidade — Web Share API no telemóvel
// (abre o menu nativo de partilha, incluindo WhatsApp/Telegram/etc.),
// com fallback para copiar para a área de transferência no desktop.
export function ShareCommunityLink({ communityId, communityName }: { communityId: string; communityName: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/communities/${communityId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: communityName, text: `Junta-te à comunidade "${communityName}"`, url });
      } catch {
        // utilizador cancelou a folha de partilha — não é um erro a mostrar
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={share}
      className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
    >
      {copied ? (
        <Check size={13} className="text-green-600 dark:text-green-400" />
      ) : typeof navigator !== "undefined" && "share" in navigator ? (
        <Share2 size={13} />
      ) : (
        <Link2 size={13} />
      )}
      {copied ? "Link copiado!" : "Partilhar comunidade"}
    </button>
  );
}
