"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { CategoryPicker } from "@/components/instructor/CategoryPicker";
import { FileUploadInput } from "@/components/instructor/FileUploadInput";

type RequirementType =
  | "PURCHASED_COURSE"
  | "COMPLETED_COURSE"
  | "MIN_ENROLLMENTS"
  | "MIN_COMPLETED_COURSES"
  | "MIN_REVIEWS"
  | "INSTRUCTOR_ONLY"
  | "STUDENT_ONLY";

const REQUIREMENT_TYPE_OPTIONS: { value: RequirementType; label: string; needsCourse?: boolean; needsMin?: boolean }[] = [
  { value: "PURCHASED_COURSE", label: "Estar inscrito num curso específico", needsCourse: true },
  { value: "COMPLETED_COURSE", label: "Ter terminado um curso específico", needsCourse: true },
  { value: "MIN_ENROLLMENTS", label: "Número mínimo de inscrições", needsMin: true },
  { value: "MIN_COMPLETED_COURSES", label: "Número mínimo de cursos terminados", needsMin: true },
  { value: "MIN_REVIEWS", label: "Número mínimo de avaliações escritas", needsMin: true },
  { value: "INSTRUCTOR_ONLY", label: "Ser instrutor" },
  { value: "STUDENT_ONLY", label: "Ser aluno" },
];

interface RequirementDraft {
  key: string;
  type: RequirementType;
  courseId?: string;
  courseLabel?: string;
  minValue?: string;
}

function CourseSearchInput({
  value,
  onSelect,
}: {
  value: string | undefined;
  onSelect: (courseId: string, title: string) => void;
}) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/courses/search?q=${encodeURIComponent(query.trim())}`)
        .then((res) => (res.ok ? res.json() : { courses: [] }))
        .then((data) => setResults(data.courses ?? []))
        .catch(() => setResults([]));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Procurar curso..."
      />
      {open && results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-neutral-900">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(c.id, c.title);
                setQuery(c.title);
                setOpen(false);
              }}
              className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5"
            >
              {c.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Criação de comunidade — mesma taxonomia de categorias dos cursos
// (CategoryPicker já existe para isso, reaproveitado aqui tal e qual).
// Requisitos de entrada (opcional, "quanto mais tipos melhor" foi o pedido)
// são verificados a sério no servidor, tanto no ecrã de aceitação como de
// novo dentro do próprio POST /join — ver lib/communityAccess.ts.
export function CommunityForm() {
  const { fadeNavigate } = useFadeNav();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [requirements, setRequirements] = useState<RequirementDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRequirement() {
    setRequirements((prev) => [...prev, { key: crypto.randomUUID(), type: "PURCHASED_COURSE" }]);
  }
  function updateRequirement(key: string, patch: Partial<RequirementDraft>) {
    setRequirements((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRequirement(key: string) {
    setRequirements((prev) => prev.filter((r) => r.key !== key));
  }

  async function create() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Indica um nome para a comunidade");
      return;
    }
    if (!category.trim()) {
      setError("Escolhe uma categoria");
      return;
    }
    for (const r of requirements) {
      const opt = REQUIREMENT_TYPE_OPTIONS.find((o) => o.value === r.type)!;
      if (opt.needsCourse && !r.courseId) {
        setError("Escolhe um curso para cada requisito de curso");
        return;
      }
      if (opt.needsMin && (!r.minValue || Number(r.minValue) < 1)) {
        setError("Indica um valor mínimo válido para cada requisito numérico");
        return;
      }
    }

    setSaving(true);
    const res = await fetch("/api/communities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        category: category.trim(),
        description: description.trim() || null,
        rules: rules.trim() || null,
        coverImageUrl,
        bannerUrl,
        requirements: requirements.map((r) => ({
          type: r.type,
          ...(r.courseId ? { courseId: r.courseId } : {}),
          ...(r.minValue ? { minValue: Number(r.minValue) } : {}),
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao criar comunidade");
      return;
    }
    const created = await res.json();
    fadeNavigate(`/communities/${created.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Criar comunidade</h1>

      {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

      <Card className="space-y-4 p-4">
        <div>
          <Label htmlFor="community-name">Nome</Label>
          <Input id="community-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div>
          <Label htmlFor="community-category">Categoria</Label>
          <CategoryPicker id="community-category" value={category} onChange={setCategory} />
        </div>
        <div>
          <Label htmlFor="community-description">Descrição</Label>
          <Textarea
            id="community-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Sobre o que é esta comunidade..."
          />
        </div>
        <div>
          <Label htmlFor="community-rules">Regras</Label>
          <Textarea
            id="community-rules"
            rows={4}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            maxLength={4000}
            placeholder="O que é permitido/proibido nesta comunidade..."
          />
        </div>
        <div>
          <Label>Avatar</Label>
          <FileUploadInput kind="IMAGE" currentUrl={coverImageUrl} onUploaded={(result) => setCoverImageUrl(result.url)} />
        </div>
        <div>
          <Label>Banner</Label>
          <FileUploadInput kind="IMAGE" currentUrl={bannerUrl} onUploaded={(result) => setBannerUrl(result.url)} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Requisitos para entrar (opcional)
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Quem quiser entrar só consegue se cumprir todos os que definires aqui.
        </p>
        <div className="space-y-2">
          {requirements.map((r) => {
            const opt = REQUIREMENT_TYPE_OPTIONS.find((o) => o.value === r.type)!;
            return (
              <div key={r.key} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-2 dark:border-white/10">
                <select
                  value={r.type}
                  onChange={(e) => updateRequirement(r.key, { type: e.target.value as RequirementType, courseId: undefined, minValue: undefined })}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {REQUIREMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                      {o.label}
                    </option>
                  ))}
                </select>
                {opt.needsCourse && (
                  <CourseSearchInput value={r.courseLabel} onSelect={(courseId, title) => updateRequirement(r.key, { courseId, courseLabel: title })} />
                )}
                {opt.needsMin && (
                  <Input
                    type="number"
                    min={1}
                    placeholder="Nº"
                    value={r.minValue ?? ""}
                    onChange={(e) => updateRequirement(r.key, { minValue: e.target.value })}
                    className="w-20"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeRequirement(r.key)}
                  aria-label="Remover requisito"
                  className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-white/10"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addRequirement}
          className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <Plus size={14} /> Adicionar requisito
        </button>
      </Card>

      <Button type="button" onClick={create} disabled={saving}>
        {saving ? "A criar..." : "Criar comunidade"}
      </Button>
    </div>
  );
}
