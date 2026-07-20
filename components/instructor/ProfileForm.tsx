"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea, Label } from "@/components/ui/Input";

export function ProfileForm({ initialBio }: { initialBio: string }) {
  const router = useRouter();
  const [bio, setBio] = useState(initialBio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/instructor/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <Label htmlFor="bio">Bio pública</Label>
        <Textarea
          id="bio"
          rows={4}
          maxLength={600}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Conta um pouco sobre a tua experiência e o que ensinas..."
        />
        <p className="mt-1 text-xs text-slate-400">{bio.length}/600</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "A guardar..." : "Guardar"}
        </Button>
        {saved && <span className="text-sm text-slate-500">Guardado.</span>}
      </div>
    </form>
  );
}
