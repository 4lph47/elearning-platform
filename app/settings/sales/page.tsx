"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { LayoutGrid, ShoppingBag, BarChart3 } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function SettingsSalesPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [commission, setCommission] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((d) => setCommission(d.defaultResaleMinCommission != null ? String(d.defaultResaleMinCommission) : ""))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultResaleMinCommission: commission.trim() === "" ? null : Number(commission),
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (status !== "authenticated" || session.user.role === "STUDENT") {
    return (
      <SettingsSection title="Preferências de venda" description="Disponível só para contas de instrutor.">
        <FadeLink
          href="/register/complete?role=instrutor"
          className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          Tornar-me instrutor
        </FadeLink>
      </SettingsSection>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Comissão mínima de revenda por omissão"
        description="Valor pré-preenchido sempre que crias um curso novo — continuas a poder mudar ou desligar por curso."
      >
        {loading ? (
          <p className="text-sm text-slate-400">A carregar...</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="max-w-[10rem]">
              <Label htmlFor="commission">Comissão (€)</Label>
              <Input
                id="commission"
                type="number"
                min={0}
                step="0.01"
                placeholder="Ex.: 10"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="mt-6">
              {saving ? "A guardar..." : "Guardar"}
            </Button>
            {saved && <span className="mt-6 text-sm text-emerald-600 dark:text-emerald-400">Guardado.</span>}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Gerir vendas" description="Acesso rápido às ferramentas de instrutor.">
        <div className="flex flex-wrap gap-2">
          <FadeLink href="/instructor" className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
            <LayoutGrid size={14} /> Meus cursos
          </FadeLink>
          <FadeLink href="/instructor/resale" className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
            <ShoppingBag size={14} /> Gerir revendas
          </FadeLink>
          <FadeLink href="/instructor/analytics" className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
            <BarChart3 size={14} /> Analytics
          </FadeLink>
        </div>
      </SettingsSection>
    </div>
  );
}
