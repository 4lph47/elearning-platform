"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

const LEVELS = [
  { value: "beginner", label: "Iniciante" },
  { value: "intermediate", label: "Intermédio" },
  { value: "advanced", label: "Avançado" },
];

export function SearchBar({ categories }: { categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const category = searchParams.get("category") ?? "";
  const level = searchParams.get("level") ?? "";
  const price = searchParams.get("price") ?? "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    updateParam("q", q);
  }

  const selectClass =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white";

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1 sm:max-w-md">
          <input
            placeholder="Procurar cursos..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
          />
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Procurar
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <select value={category} onChange={(e) => updateParam("category", e.target.value)} className={selectClass}>
          <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="">
            Todas as categorias
          </option>
          {categories.map((c) => (
            <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select value={level} onChange={(e) => updateParam("level", e.target.value)} className={selectClass}>
          <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="">
            Todos os níveis
          </option>
          {LEVELS.map((l) => (
            <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <select value={price} onChange={(e) => updateParam("price", e.target.value)} className={selectClass}>
          <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="">
            Qualquer preço
          </option>
          <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="free">
            Grátis
          </option>
          <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="paid">
            Pago
          </option>
        </select>

        {(category || level || price) && (
          <button
            onClick={() => router.push(pathname)}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
