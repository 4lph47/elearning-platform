"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function SettingsAdsPage() {
  const [loading, setLoading] = useState(true);
  const [adsPersonalization, setAdsPersonalization] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d) => setAdsPersonalization(d.adsPersonalization))
      .finally(() => setLoading(false));
  }, []);

  async function handleChange(value: boolean) {
    setAdsPersonalization(value);
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adsPersonalization: value }),
    });
    setSaving(false);
  }

  if (loading) return <p className="text-sm text-slate-400">A carregar...</p>;

  return (
    <SettingsSection
      title="Preferências de anúncios"
      description="Controla como os teus dados de utilização (cursos vistos, categorias de interesse) são usados para personalizar anúncios e recomendações na plataforma."
    >
      <Toggle
        checked={adsPersonalization}
        onChange={handleChange}
        labelPosition="left"
        label="Personalizar anúncios com base na minha atividade"
      />
      {saving && <p className="mt-2 text-xs text-slate-400">A guardar...</p>}
    </SettingsSection>
  );
}
