"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { Toggle } from "@/components/ui/Toggle";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function SettingsCoursesPage() {
  const [loading, setLoading] = useState(true);
  const [autoplayNextLesson, setAutoplayNextLesson] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d) => setAutoplayNextLesson(d.autoplayNextLesson))
      .finally(() => setLoading(false));
  }, []);

  async function handleChange(value: boolean) {
    setAutoplayNextLesson(value);
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoplayNextLesson: value }),
    });
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Reprodução"
        description="Quando um vídeo termina e há uma aula a seguir no curso, avança sozinho depois de uma contagem de 5 segundos (podes cancelar a qualquer momento)."
      >
        {loading ? (
          <p className="text-sm text-slate-400">A carregar...</p>
        ) : (
          <Toggle
            checked={autoplayNextLesson}
            onChange={handleChange}
            labelPosition="left"
            label="Reproduzir a próxima aula automaticamente"
          />
        )}
        {saving && <p className="mt-2 text-xs text-slate-400">A guardar...</p>}
      </SettingsSection>

      <SettingsSection title="Os meus cursos" description="Acesso rápido ao progresso e inscrições.">
        <FadeLink href="/dashboard" className="flex w-fit items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
          <LayoutDashboard size={14} /> A minha aprendizagem
        </FadeLink>
      </SettingsSection>
    </div>
  );
}
