"use client";

import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function SettingsLanguagePage() {
  const [loading, setLoading] = useState(true);
  const [locale, setLocale] = useState("pt");

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d) => setLocale(d.locale))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-400">A carregar...</p>;

  return (
    <SettingsSection
      title="Idioma e região"
      description="A plataforma está disponível apenas em português por agora — mais idiomas em breve."
    >
      <select
        value={locale}
        disabled
        className="w-full max-w-xs rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
      >
        <option value="pt">Português</option>
      </select>
      <p className="mt-2 text-xs text-slate-400">Datas mostradas no formato dd/mm/aaaa.</p>
    </SettingsSection>
  );
}
