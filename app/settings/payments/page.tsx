"use client";

import { useSession } from "next-auth/react";
import { CreditCard, LayoutDashboard, BarChart3 } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { Badge } from "@/components/ui/Card";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function SettingsPaymentsPage() {
  const { data: session } = useSession();

  return (
    <div className="space-y-5">
      <SettingsSection title="Métodos de pagamento" description="Cartões e outros métodos de pagamento guardados.">
        <div className="flex items-center gap-2 opacity-60">
          <CreditCard size={16} />
          <span className="text-sm text-slate-600 dark:text-slate-300">Checkout de demonstração — sem métodos reais guardados</span>
          <Badge tone="warning">Em breve</Badge>
        </div>
      </SettingsSection>

      <SettingsSection title="Compras e ganhos" description="Histórico de inscrições e, para instrutores, receitas de vendas/revendas.">
        <div className="flex flex-wrap gap-2">
          <FadeLink href="/dashboard" className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
            <LayoutDashboard size={14} /> Os meus cursos
          </FadeLink>
          {session?.user.role !== "STUDENT" && (
            <FadeLink href="/instructor/analytics" className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
              <BarChart3 size={14} /> Analytics e receitas
            </FadeLink>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
