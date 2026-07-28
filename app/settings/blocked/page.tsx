"use client";

import { useEffect, useState } from "react";
import { UserX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SettingsSection } from "@/components/settings/SettingsSection";

interface BlockedUser {
  id: string;
  user: { id: string; name: string; username: string | null; image: string | null };
}

export default function SettingsBlockedPage() {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [username, setUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    return fetch("/api/settings/blocked")
      .then((res) => res.json())
      .then((d: BlockedUser[]) => setBlocked(d));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function handleBlock() {
    setAdding(true);
    setError(null);
    const res = await fetch("/api/settings/blocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim().replace(/^@/, "") }),
    });
    setAdding(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Não foi possível bloquear");
      return;
    }
    setUsername("");
    await load();
  }

  async function handleUnblock(id: string) {
    await fetch(`/api/settings/blocked?id=${id}`, { method: "DELETE" });
    setBlocked((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="space-y-5">
      <SettingsSection title="Bloquear alguém" description="Bloqueia pelo @username — a pessoa deixa de aparecer para ti nas menções.">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            className="max-w-xs"
          />
          <Button onClick={handleBlock} disabled={adding || !username.trim()}>
            {adding && <Loader2 size={14} className="animate-spin" />} Bloquear
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </SettingsSection>

      <SettingsSection title="Pessoas bloqueadas" description="Lista de quem bloqueaste.">
        {loading ? (
          <p className="text-sm text-slate-400">A carregar...</p>
        ) : blocked.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não bloqueaste ninguém.</p>
        ) : (
          <div className="space-y-2">
            {blocked.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10"
              >
                <div className="flex items-center gap-2.5">
                  {b.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.user.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-white/10">
                      <UserX size={14} />
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{b.user.name}</p>
                    {b.user.username && <p className="text-xs text-slate-500 dark:text-slate-400">@{b.user.username}</p>}
                  </div>
                </div>
                <Button variant="outline" onClick={() => handleUnblock(b.id)}>
                  Desbloquear
                </Button>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
