"use client";

import { useState } from "react";
import { X } from "lucide-react";

export const SORT_OPTIONS = [
  { value: "", label: "Relevância" },
  { value: "recent", label: "Mais recentes" },
  { value: "rating", label: "Melhor avaliação" },
  { value: "reviews", label: "Mais avaliações" },
  { value: "popular", label: "Mais matriculados" },
  { value: "favorites", label: "Mais favoritos" },
  { value: "comments", label: "Mais comentados" },
  { value: "price_asc", label: "Preço: menor primeiro" },
  { value: "price_desc", label: "Preço: maior primeiro" },
] as const;

export const LEVEL_OPTIONS = [
  { value: "beginner", label: "Iniciante" },
  { value: "intermediate", label: "Intermédio" },
  { value: "advanced", label: "Avançado" },
] as const;

export const MAX_PRICE_CEIL = 200;
export const MAX_DURATION_HOURS = 40;
export const MAX_ENROLLMENTS_CEIL = 500;

type SliderKey = "price" | "duration" | "enrollments";

export interface FilterValues {
  sort: string;
  categories: string[];
  level: string;
  maxPrice: number;
  minDuration: number;
  minEnrollments: number;
}

export const DEFAULT_FILTER_VALUES: FilterValues = {
  sort: "",
  categories: [],
  level: "",
  maxPrice: MAX_PRICE_CEIL,
  minDuration: 0,
  minEnrollments: 0,
};

function pillClass(active: boolean) {
  return `shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-slate-400 bg-slate-200 text-slate-900 dark:border-white/30 dark:bg-white/15 dark:text-white"
      : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
  }`;
}

// Painel de ecrã inteiro (não um dropdown pequeno) — secções por tipo de
// filtro, 3 delas (preço/duração/matrículas) com escala (slider) que só
// aparece ao clicar no próprio botão do filtro; clicar de novo fecha a
// escala e o valor selecionado fica no botão. Aplicar só grava tudo de uma
// vez (um único pedido ao servidor, em vez de um por campo alterado).
export function FilterPanel({
  categories: allCategories,
  values,
  onApply,
  onClose,
}: {
  categories: string[];
  values: FilterValues;
  onApply: (values: FilterValues) => void;
  onClose: () => void;
}) {
  const [sort, setSort] = useState(values.sort);
  const [categories, setCategories] = useState(values.categories);
  const [level, setLevel] = useState(values.level);
  const [maxPrice, setMaxPrice] = useState(values.maxPrice);
  const [minDuration, setMinDuration] = useState(values.minDuration);
  const [minEnrollments, setMinEnrollments] = useState(values.minEnrollments);
  const [openSlider, setOpenSlider] = useState<SliderKey | null>(null);
  // Sem isto o painel desaparecia de repente ao aplicar/cancelar — o
  // fadeNavigate do curtain só começa a cobrir a página POR BAIXO; se o
  // painel some instantâneo, dá um flash do conteúdo antigo antes da
  // cortina apanhar. Esmorecer aqui primeiro liga as duas transições.
  const CLOSE_MS = 200;
  const [closing, setClosing] = useState(false);

  function toggleSlider(key: SliderKey) {
    setOpenSlider((s) => (s === key ? null : key));
  }

  function toggleCategory(c: string) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function requestClose() {
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }

  function apply() {
    onApply({ sort, categories, level, maxPrice, minDuration, minEnrollments });
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
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Ordenar por</h3>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((o) => (
                <button key={o.value} type="button" onClick={() => setSort(o.value)} className={pillClass(sort === o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Categoria {categories.length > 0 ? `(${categories.length})` : ""}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setCategories([])} className={pillClass(categories.length === 0)}>
                Todas
              </button>
              {allCategories.map((c) => (
                <button key={c} type="button" onClick={() => toggleCategory(c)} className={pillClass(categories.includes(c))}>
                  {c}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Nível</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setLevel("")} className={pillClass(level === "")}>
                Todos
              </button>
              {LEVEL_OPTIONS.map((l) => (
                <button key={l.value} type="button" onClick={() => setLevel(l.value)} className={pillClass(level === l.value)}>
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Escalas</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleSlider("price")}
                className={pillClass(openSlider === "price" || maxPrice < MAX_PRICE_CEIL)}
              >
                Preço{maxPrice < MAX_PRICE_CEIL ? `: até ${maxPrice}€` : ""}
              </button>
              <button
                type="button"
                onClick={() => toggleSlider("duration")}
                className={pillClass(openSlider === "duration" || minDuration > 0)}
              >
                Duração{minDuration > 0 ? `: ${minDuration}h+` : ""}
              </button>
              <button
                type="button"
                onClick={() => toggleSlider("enrollments")}
                className={pillClass(openSlider === "enrollments" || minEnrollments > 0)}
              >
                Alunos matriculados{minEnrollments > 0 ? `: ${minEnrollments}+` : ""}
              </button>
            </div>

            {openSlider === "price" && (
              <div className="mt-4 rounded-md border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                  <span>Preço máximo</span>
                  <span className="font-semibold">{maxPrice >= MAX_PRICE_CEIL ? "Sem limite" : `${maxPrice}€`}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_PRICE_CEIL}
                  step={5}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="mt-3 w-full accent-blue-600"
                />
              </div>
            )}
            {openSlider === "duration" && (
              <div className="mt-4 rounded-md border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                  <span>Duração mínima</span>
                  <span className="font-semibold">{minDuration === 0 ? "Qualquer" : `${minDuration}h`}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_DURATION_HOURS}
                  step={1}
                  value={minDuration}
                  onChange={(e) => setMinDuration(Number(e.target.value))}
                  className="mt-3 w-full accent-blue-600"
                />
              </div>
            )}
            {openSlider === "enrollments" && (
              <div className="mt-4 rounded-md border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-200">
                  <span>Alunos matriculados (mínimo)</span>
                  <span className="font-semibold">{minEnrollments === 0 ? "Qualquer" : `${minEnrollments}+`}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={MAX_ENROLLMENTS_CEIL}
                  step={10}
                  value={minEnrollments}
                  onChange={(e) => setMinEnrollments(Number(e.target.value))}
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
