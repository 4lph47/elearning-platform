"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
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
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backHref = session?.user.role === "STUDENT" ? "/dashboard/resale" : "/instructor/resale";
  const course = useMemo(() => eligibleCourses.find((c) => c.id === courseId), [eligibleCourses, courseId]);
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
          <div>
            <Label htmlFor="listing-course">Curso</Label>
            <select
              id="listing-course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              {eligibleCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
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
