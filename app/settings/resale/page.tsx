"use client";

import { useSession } from "next-auth/react";
import { ShoppingBag, Store, PlusCircle } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { SettingsSection } from "@/components/settings/SettingsSection";

export default function SettingsResalePage() {
  const { data: session } = useSession();
  const manageHref = session?.user.role === "STUDENT" ? "/dashboard/resale" : "/instructor/resale";

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Marketplace de revenda"
        description="Qualquer aluno ou instrutor pode revender o acesso a um curso em que já está inscrito. Alterações à comissão exigida pelo instrutor original geram notificação — controla-as em Notificações."
      >
        <div className="flex flex-wrap gap-2">
          <FadeLink href="/marketplace" className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
            <Store size={14} /> Marketplace
          </FadeLink>
          <FadeLink href={manageHref} className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
            <ShoppingBag size={14} /> Minhas revendas
          </FadeLink>
          <FadeLink href="/resale/listings/new" className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
            <PlusCircle size={14} /> Criar anúncio de revenda
          </FadeLink>
        </div>
      </SettingsSection>
    </div>
  );
}
