"use client";

import { useEffect, useState } from "react";
import { Globe, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SettingsSection } from "@/components/settings/SettingsSection";

interface ConnectionsData {
  accounts: { id: string; provider: string }[];
  hasPassword: boolean;
}

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
};

export default function SettingsConnectionsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConnectionsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    return fetch("/api/settings/connections")
      .then((res) => res.json())
      .then((d: ConnectionsData) => setData(d));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleUnlink(id: string) {
    setError(null);
    const res = await fetch(`/api/settings/connections?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Não foi possível desligar");
      return;
    }
    await load();
  }

  return (
    <SettingsSection title="Aplicativos e sites" description="Serviços externos ligados à tua conta.">
      {loading || !data ? (
        <p className="text-sm text-slate-400">A carregar...</p>
      ) : data.accounts.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum serviço externo ligado — entras só por email e password.</p>
      ) : (
        <div className="space-y-2">
          {data.accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10"
            >
              <div className="flex items-center gap-2.5 text-sm text-slate-900 dark:text-white">
                <Globe size={16} /> {PROVIDER_LABEL[acc.provider] ?? acc.provider}
              </div>
              <Button variant="outline" onClick={() => handleUnlink(acc.id)}>
                <Link2Off size={14} /> Desligar
              </Button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </SettingsSection>
  );
}
