"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { SettingsSection } from "@/components/settings/SettingsSection";

interface PrivacyData {
  profileVisibility: "PUBLIC" | "PRIVATE";
  searchByEmail: boolean;
  searchByPhone: boolean;
}

export default function SettingsPrivacyPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PrivacyData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d: PrivacyData) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  async function patch(partial: Partial<PrivacyData>) {
    setData((d) => (d ? { ...d, ...partial } : d));
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    setSaving(false);
  }

  if (loading || !data) return <p className="text-sm text-slate-400">A carregar...</p>;

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Quem pode ver o teu perfil"
        description="Define se o teu perfil público (cursos, certificações, comunidades) pode ser visto por qualquer pessoa ou só por ti."
      >
        <Toggle
          checked={data.profileVisibility === "PUBLIC"}
          onChange={(v) => patch({ profileVisibility: v ? "PUBLIC" : "PRIVATE" })}
          labelPosition="left"
          label={data.profileVisibility === "PUBLIC" ? "Perfil público — qualquer pessoa pode ver" : "Perfil privado — só tu podes ver"}
        />
      </SettingsSection>

      <SettingsSection
        title="Ser encontrado por email ou telefone"
        description="Permite que outras pessoas te encontrem na pesquisa a partir do teu email ou número de telefone."
      >
        <div className="space-y-3">
          <Toggle
            checked={data.searchByEmail}
            onChange={(v) => patch({ searchByEmail: v })}
            labelPosition="left"
            label="Permitir pesquisa pelo meu email"
          />
          <Toggle
            checked={data.searchByPhone}
            onChange={(v) => patch({ searchByPhone: v })}
            labelPosition="left"
            label="Permitir pesquisa pelo meu telefone"
          />
        </div>
        {saving && <p className="mt-2 text-xs text-slate-400">A guardar...</p>}
      </SettingsSection>
    </div>
  );
}
