"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Search } from "lucide-react";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export interface EligibleResaleCourse {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  minCommission: number;
}

// Página dedicada para criar uma revenda — espelha o BundleForm em
// /resale/bundles/new. Escolhe um curso já terminado (com revenda ativada
// pelo instrutor e ainda não listado) e define o preço.
export function CreateResaleListingForm({ eligibleCourses }: { eligibleCourses: EligibleResaleCourse[] }) {
  const { fadeNavigate } = useFadeNav();
  const { data: session } = useSession();
  const [courseId, setCourseId] = useState<string>(eligibleCourses[0]?.id ?? "");
  const [query, setQuery] = useState(eligibleCourses[0]?.title ?? "");
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const backHref = session?.user.role === "STUDENT" ? "/dashboard/resale" : "/instructor/resale";
  const course = useMemo(() => eligibleCourses.find((c) => c.id === courseId), [eligibleCourses, courseId]);
  const filteredCourses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || course?.title === query) return eligibleCourses;
    return eligibleCourses.filter((c) => c.title.toLowerCase().includes(q));
  }, [eligibleCourses, query, course]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function selectCourse(c: EligibleResaleCourse) {
    setCourseId(c.id);
    setQuery(c.title);
    setOpen(false);
  }
  const priceNum = Number(price);
  const validPrice = course ? priceNum >= course.minCommission : false;
  const sellerCut = course && validPrice ? priceNum - course.minCommission : null;

  async function create() {
    setError(null);
    if (!course) {
      setError("Escolhe um curso");
      return;
    }
    if (!priceNum || priceNum <= 0) {
      setError("Indica um preço válido");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/resale/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: course.id, price: priceNum }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao criar revenda");
      return;
    }
    fadeNavigate(backHref);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Criar revenda</h1>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      {eligibleCourses.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Não tens cursos elegíveis para revenda de momento — só cursos que já terminaste, com a revenda ativada
            pelo instrutor e que ainda não tenhas colocado à venda, aparecem aqui.
          </p>
        </Card>
      ) : (
        <Card className="space-y-4 p-4">
          <div ref={wrapRef} className="relative">
            <Label htmlFor="listing-course">Curso</Label>
            <div className="relative">
              <input
                id="listing-course"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder="Procurar curso..."
                autoComplete="off"
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
            {open && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg dark:border-white/10 dark:bg-neutral-900">
                {filteredCourses.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Nenhum curso encontrado.</p>
                ) : (
                  filteredCourses.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectCourse(c)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <span className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-white/10">
                        {c.thumbnailUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="truncate text-sm text-slate-700 dark:text-slate-200">{c.title}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="listing-price">Preço</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="listing-price"
                type="number"
                min={course?.minCommission ?? 0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-32"
              />
              <span className="text-sm text-slate-500 dark:text-slate-400">€</span>
            </div>
            {course && (
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Comissão do instrutor (fixa):{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{course.minCommission.toFixed(2)}€</span>
                </span>
                <span>
                  A tua parte:{" "}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {sellerCut !== null ? `${sellerCut.toFixed(2)}€` : "—"}
                  </span>
                </span>
              </div>
            )}
          </div>

          <Button type="button" onClick={create} disabled={saving}>
            {saving ? "A criar..." : "Colocar à venda"}
          </Button>
        </Card>
      )}
    </div>
  );
}
