"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Trash2 } from "lucide-react";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export interface EligibleCourse {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
}

// Bundle do próprio instrutor (agrupa cursos que dá para venda direta) —
// espelha components/resale/BundleForm.tsx, mais simples porque não tem
// descrição/capa/preço próprio (Bundle não tem esses campos no schema).
export function BundleForm({
  mode,
  bundleId,
  initialName = "",
  initialCourseIds = [],
  eligibleCourses,
}: {
  mode: "create" | "edit";
  bundleId?: string;
  initialName?: string;
  initialCourseIds?: string[];
  eligibleCourses: EligibleCourse[];
}) {
  const { fadeNavigate } = useFadeNav();
  const [name, setName] = useState(initialName);
  const [courseIds, setCourseIds] = useState<string[]>(initialCourseIds);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedCourses = courseIds
    .map((id) => eligibleCourses.find((c) => c.id === id))
    .filter((c): c is EligibleCourse => c !== undefined);

  const searchableCourses = useMemo(
    () => eligibleCourses.filter((c) => !courseIds.includes(c.id)),
    [eligibleCourses, courseIds]
  );
  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return searchableCourses;
    return searchableCourses.filter((c) => c.title.toLowerCase().includes(q));
  }, [searchableCourses, query]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function addCourse(id: string) {
    setCourseIds((prev) => [...prev, id]);
    setQuery("");
    setOpen(false);
  }

  function removeCourse(id: string) {
    setCourseIds((prev) => prev.filter((x) => x !== id));
  }

  async function save() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Indica um nome para o bundle");
      return;
    }
    if (courseIds.length === 0) {
      setError("Escolhe pelo menos um curso para o bundle");
      return;
    }
    setSaving(true);
    const res = await fetch(mode === "create" ? "/api/instructor/bundles" : `/api/instructor/bundles/${bundleId}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), courseIds }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar bundle");
      return;
    }
    fadeNavigate("/instructor");
  }

  async function deleteBundle() {
    if (!bundleId) return;
    setError(null);
    setDeleting(true);
    const res = await fetch(`/api/instructor/bundles/${bundleId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao remover bundle");
      return;
    }
    fadeNavigate("/instructor");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {mode === "create" ? "Criar bundle" : "Editar bundle"}
      </h1>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <Card className="space-y-4 p-4">
        <div>
          <Label htmlFor="bundle-name">Nome</Label>
          <Input id="bundle-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cursos incluídos</h2>
        {eligibleCourses.length === 0 && selectedCourses.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Não tens cursos disponíveis para meter neste bundle — só cursos teus que ainda não estejam noutro
            bundle aparecem aqui.
          </p>
        ) : (
          <>
            <div ref={wrapRef} className="relative">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  placeholder="Procurar curso para adicionar..."
                  autoComplete="off"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              {open && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-white/10 dark:bg-neutral-900">
                  {filteredCourses.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                      {searchableCourses.length === 0 ? "Já adicionaste todos os teus cursos elegíveis." : "Nenhum curso encontrado."}
                    </p>
                  ) : (
                    filteredCourses.map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addCourse(course.id)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                      >
                        <span className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-white/10">
                          {course.thumbnailUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={course.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{course.title}</span>
                        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{course.price.toFixed(2)}€</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedCourses.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não escolheste nenhum curso.</p>
            ) : (
              <div className="space-y-1">
                {selectedCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{course.title}</span>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{course.price.toFixed(2)}€</span>
                    <button
                      type="button"
                      onClick={() => removeCourse(course.id)}
                      className="shrink-0 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <div className="flex items-center justify-between gap-2">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "A guardar..." : mode === "create" ? "Criar bundle" : "Guardar alterações"}
        </Button>
        {mode === "edit" && (
          <button
            type="button"
            disabled={deleting}
            onClick={deleteBundle}
            className="flex items-center gap-1 text-sm font-medium text-red-600 hover:underline dark:text-red-400"
          >
            <Trash2 size={14} /> Eliminar bundle
          </button>
        )}
      </div>
    </div>
  );
}
