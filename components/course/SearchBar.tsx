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
    "rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1 sm:max-w-md">
          <input
            placeholder="Procurar cursos..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          <option className="bg-slate-900" value="">
            Todas as categorias
          </option>
          {categories.map((c) => (
            <option className="bg-slate-900" key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select value={level} onChange={(e) => updateParam("level", e.target.value)} className={selectClass}>
          <option className="bg-slate-900" value="">
            Todos os níveis
          </option>
          {LEVELS.map((l) => (
            <option className="bg-slate-900" key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <select value={price} onChange={(e) => updateParam("price", e.target.value)} className={selectClass}>
          <option className="bg-slate-900" value="">
            Qualquer preço
          </option>
          <option className="bg-slate-900" value="free">
            Grátis
          </option>
          <option className="bg-slate-900" value="paid">
            Pago
          </option>
        </select>

        {(category || level || price) && (
          <button
            onClick={() => router.push(pathname)}
            className="text-sm font-medium text-slate-400 hover:text-white"
          >
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
