"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { HorizontalScrollRow } from "@/components/course/HorizontalScrollRow";
import { ResaleListingTile, ResaleBundleTile } from "@/components/resale/ResaleTile";
import type { ResaleListingCardData, ResaleBundleCardData } from "@/components/resale/types";

export interface EligibleCourse {
  id: string;
  title: string;
  minCommission: number;
}

// Listas horizontais iguais ao catálogo, sem CollapsibleCard nenhum a
// esconder tudo atrás dum clique — só isto e o formulário de criar é que
// vivem aqui. Editar uma listagem ou bundle já existente é só clicar no
// tile: o link do ResaleListingTile já leva à própria página do curso
// (?resale=id), onde o dono vê o CRUD completo (ManageResaleListingCard);
// o do ResaleBundleTile leva à página do bundle, que mostra "Editar bundle"
// ao dono. Nenhum dos dois precisa de UI de edição duplicada aqui.
export function ManageResaleSection({
  eligibleCourses,
  listings,
  bundles,
  canCreateBundle,
}: {
  eligibleCourses: EligibleCourse[];
  listings: ResaleListingCardData[];
  bundles: ResaleBundleCardData[];
  canCreateBundle: boolean;
}) {
  const router = useRouter();
  const [priceByCourse, setPriceByCourse] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (eligibleCourses.length === 0 && listings.length === 0 && bundles.length === 0) return null;

  async function handleError(res: Response) {
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Erro ao processar pedido");
  }

  async function createListing(courseId: string) {
    setError(null);
    const price = Number(priceByCourse[courseId]);
    if (!price || price <= 0) {
      setError("Indica um preço válido");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/resale/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, price }),
    });
    setBusy(false);
    if (!res.ok) return handleError(res);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {eligibleCourses.length > 0 && (
        <div>
          <Label>Cursos que podes vender</Label>
          <div className="space-y-2">
            {eligibleCourses.map((course) => (
              <div key={course.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-2 dark:border-white/10">
                <span className="min-w-0 flex-1 truncate text-sm">{course.title}</span>
                <span className="text-xs text-slate-500">mín. {course.minCommission.toFixed(2)}€</span>
                <Input
                  type="number"
                  min={course.minCommission}
                  step="0.01"
                  placeholder="Preço"
                  value={priceByCourse[course.id] ?? ""}
                  onChange={(e) => setPriceByCourse((prev) => ({ ...prev, [course.id]: e.target.value }))}
                  className="w-24"
                />
                <Button type="button" variant="outline" disabled={busy} onClick={() => createListing(course.id)}>
                  Colocar à venda
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(bundles.length > 0 || listings.length > 0) && (
        <div className="-mx-4 space-y-1 sm:-mx-8">
          {bundles.length > 0 && (
            <HorizontalScrollRow title="Os teus bundles">
              {bundles.map((b) => (
                <div key={b.id} className="w-64 shrink-0 sm:w-72">
                  <ResaleBundleTile bundle={b} />
                </div>
              ))}
            </HorizontalScrollRow>
          )}
          {listings.length > 0 && (
            <HorizontalScrollRow title="As tuas listagens">
              {listings.map((l) => (
                <div key={l.id} className="relative w-64 shrink-0 sm:w-72">
                  {l.active === false && (
                    <span className="absolute left-2 top-2 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      Desativada
                    </span>
                  )}
                  <ResaleListingTile listing={l} />
                </div>
              ))}
            </HorizontalScrollRow>
          )}
        </div>
      )}

      {canCreateBundle && (
        <FadeLink
          href="/resale/bundles/new"
          className="flex w-fit items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
        >
          <Plus size={14} /> Criar bundle
        </FadeLink>
      )}
    </div>
  );
}
