"use client";

import { useEffect, useState } from "react";
import { Users, PlusCircle } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { Toggle } from "@/components/ui/Toggle";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function SettingsCommunitiesPage() {
  const [loading, setLoading] = useState(true);
  const [showCommunitiesOnProfile, setShowCommunitiesOnProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d) => setShowCommunitiesOnProfile(d.showCommunitiesOnProfile))
      .finally(() => setLoading(false));
  }, []);

  async function handleChange(value: boolean) {
    setShowCommunitiesOnProfile(value);
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showCommunitiesOnProfile: value }),
    });
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Visibilidade"
        description="Controla se as comunidades de que fazes parte ficam visíveis no teu perfil público."
      >
        {loading ? (
          <p className="text-sm text-slate-400">A carregar...</p>
        ) : (
          <Toggle
            checked={showCommunitiesOnProfile}
            onChange={handleChange}
            labelPosition="left"
            label="Mostrar as minhas comunidades no perfil público"
          />
        )}
        {saving && <p className="mt-2 text-xs text-slate-400">A guardar...</p>}
      </SettingsSection>

      <SettingsSection
        title="Gerir comunidades"
        description="Menções em conversas de comunidades geram notificação — controla-as em Notificações."
      >
        <div className="flex flex-wrap gap-2">
          <FadeLink href="/communities" className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
            <Users size={14} /> As minhas comunidades
          </FadeLink>
          <FadeLink href="/communities/new" className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
            <PlusCircle size={14} /> Criar comunidade
          </FadeLink>
        </div>
      </SettingsSection>
    </div>
  );
}
