"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";

// Mesmo trilho de "escrever + escolher entre botões" do FilterPanel — em
// vez de digitar a categoria às cegas (arriscando duplicar "Programação" e
// "programacao" como categorias diferentes), mostra as já existentes como
// botões filtráveis à medida que se escreve. Depois de escolher (existente
// ou nova), colapsa tudo num único botão com o nome — clicar nele reabre a
// busca para trocar.
export function CategoryPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [editing, setEditing] = useState(!value);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    fetch("/api/courses/categories")
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [query, categories]);

  const exactMatch = categories.some((c) => c.toLowerCase() === query.trim().toLowerCase());

  function select(category: string) {
    onChange(category);
    setQuery(category);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        id={id}
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
      >
        {value}
      </button>
    );
  }

  return (
    <div>
      <Input
        id={id}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
        }}
        placeholder="ex: Programação, Design, Marketing"
      />
      {(filtered.length > 0 || (query.trim() && !exactMatch)) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => select(c)}
              className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-200 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {c}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => select(query.trim())}
              className="flex items-center gap-1 rounded-full border border-dashed border-slate-400 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-white/25 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <Plus size={12} /> Adicionar &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
