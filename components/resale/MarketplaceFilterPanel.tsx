"use client";

import { useState } from "react";
import { X } from "lucide-react";

export const MARKETPLACE_TYPE_OPTIONS = [
  { value: "", label: "Tudo" },
  { value: "listings", label: "Cursos" },
  { value: "bundles", label: "Bundles" },
  { value: "students", label: "Alunos" },
  { value: "instructors", label: "Instrutores" },
] as const;

export const MARKETPLACE_MAX_PRICE_CEIL = 500;

export interface MarketplaceFilterValues {
  type: string;
  maxPrice: number;
}

export const DEFAULT_MARKETPLACE_FILTER_VALUES: MarketplaceFilterValues = {
  type: "",
  maxPrice: MARKETPLACE_MAX_PRICE_CEIL,
};

function pillClass(active: boolean) {
  return `shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
  }`;
}

// Painel de ecrã inteiro igual em espírito ao FilterPanel do catálogo
// (components/course/FilterPanel.tsx) — sem categoria/nível/duração porque
// não fazem sentido para revenda, só o tipo de resultado e um teto de preço.
export function MarketplaceFilterPanel({
  values,
  onApply,
  onClose,
}: {
  values: MarketplaceFilterValues;
  onApply: (values: MarketplaceFilterValues) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState(values.type);
  const [maxPrice, setMaxPrice] = useState(values.maxPrice);
  const [sliderOpen, setSliderOpen] = useState(false);
  const CLOSE_MS = 200;
  const [closing, setClosing] = useState(false);

  function requestClose() {
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }

  function apply() {
    onApply({ type, maxPrice });
    requestClose();
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-white transition-opacity dark:bg-black ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${CLOSE_MS}ms` }}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-white/10 sm:px-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Filtros</h2>
        <button
          type="button"
          onClick={requestClose}
          aria-label="Fechar filtros"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-2xl space-y-8">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Pesquisar por</h3>
            <div className="flex flex-wrap gap-2">
              {MARKETPLACE_TYPE_OPTIONS.map((o) => (
                <button key={o.value} type="button" onClick={() => setType(o.value)} className={pillClass(type === o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Escala</h3>
            <button
              type="button"
              onClick={() => setSliderOpen((v) => !v)}
              className={pillClass(sliderOpen || maxPrice < MARKETPLACE_MAX_PRICE_CEIL)}
            >
              Preço{maxPrice < MARKETPLACE_MAX_PRICE_CEIL ? `: até ${maxPrice}€` : ""}
            </button>
            {sliderOpen && (
              <div className="mt-4 rounded-md border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                  <span>Preço máximo</span>
                  <span className="font-semibold">
                    {maxPrice >= MARKETPLACE_MAX_PRICE_CEIL ? "Sem limite" : `${maxPrice}€`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MARKETPLACE_MAX_PRICE_CEIL}
                  step={5}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="mt-3 w-full accent-blue-600"
                />
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-200 px-4 py-4 dark:border-white/10 sm:px-8">
        <button
          type="button"
          onClick={apply}
          className="rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Aplicar filtros
        </button>
      </div>
    </div>
  );
}
