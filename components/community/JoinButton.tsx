"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface RequirementResult {
  id: string;
  label: string;
  met: boolean;
}

// Ecrã de aceitação: mostra o checklist de requisitos (verificados a sério
// no servidor, ver lib/communityAccess.ts) e, se houver regras, obriga a
// marcar "li e concordo" antes de deixar clicar em entrar. O botão só fica
// mesmo ativo se tudo estiver cumprido — o próprio POST /join reverifica
// tudo outra vez do lado do servidor, isto é só a UI.
export function JoinButton({
  communityId,
  requirements,
  hasRules,
}: {
  communityId: string;
  requirements: RequirementResult[];
  hasRules: boolean;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(!hasRules);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allMet = requirements.every((r) => r.met);
  const canJoin = allMet && agreed;

  async function join() {
    setError(null);
    setJoining(true);
    const res = await fetch(`/api/communities/${communityId}/join`, { method: "POST" });
    setJoining(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao entrar na comunidade");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {requirements.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-slate-200 p-3 dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Requisitos para entrar
          </p>
          {requirements.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              {r.met ? (
                <Check size={15} className="shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <X size={15} className="shrink-0 text-red-500 dark:text-red-400" />
              )}
              <span className={r.met ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}>
                {r.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {hasRules && (
        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 dark:border-white/20"
          />
          Li e concordo com as regras desta comunidade
        </label>
      )}

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <Button type="button" variant="premium" onClick={join} disabled={joining || !canJoin}>
        {joining ? "A entrar..." : !allMet ? "Não cumpres os requisitos" : "Concordar e entrar"}
      </Button>
    </div>
  );
}
