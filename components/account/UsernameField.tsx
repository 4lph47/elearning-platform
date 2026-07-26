"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function formatWait(canChangeAt: string) {
  const ms = new Date(canChangeAt).getTime() - Date.now();
  const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  return days === 1 ? "1 dia" : `${days} dias`;
}

export function UsernameField({ className = "mt-3" }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [canChangeAt, setCanChangeAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account/username")
      .then((res) => res.json())
      .then((data) => {
        setSaved(data.username);
        setValue(data.username ?? "");
        setCanChangeAt(data.canChangeAt);
      })
      .finally(() => setLoading(false));
  }, []);

  const locked = Boolean(canChangeAt);
  const dirty = value.trim() !== (saved ?? "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/account/username", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: value.trim() }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível trocar o username");
      if (data.canChangeAt) setCanChangeAt(data.canChangeAt);
      return;
    }
    setSaved(data.username);
    setValue(data.username);
    setCanChangeAt(data.canChangeAt);
  }

  if (loading) {
    return <p className={`text-sm text-slate-400 ${className}`}>A carregar...</p>;
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-1.5">
          <span className="text-sm text-slate-400">@</span>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase())}
            disabled={locked}
            maxLength={20}
            placeholder="username"
          />
        </div>
        <Button onClick={handleSave} disabled={saving || !dirty || locked || value.trim().length < 3}>
          {saving ? "A guardar..." : "Guardar"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {locked && canChangeAt && !error && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Só podes trocar de username outra vez daqui a {formatWait(canChangeAt)}.
        </p>
      )}
    </div>
  );
}
