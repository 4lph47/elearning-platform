"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Star, Plus, X } from "lucide-react";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Card, Badge } from "@/components/ui/Card";
import type { QuizData } from "@/components/instructor/QuizEditor";
import { FileUploadInput } from "@/components/instructor/FileUploadInput";
import { DeleteWithConfirmName } from "@/components/instructor/DeleteWithConfirmName";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";

interface CourseData {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  published: boolean;
  slug: string;
  price: number;
  originalPrice: number | null;
  rating: number;
  ratingCount: number;
  trailerUrl: string | null;
  learningOutcomes: string[];
  requirements: string[];
  targetAudience: string[];
  topics: string[];
  bundle: { name: string; courses: { id: string }[] } | null;
  instructor: { id: string; name: string; email: string };
  collaborators: { id: string; name: string; email: string }[];
  quiz?: QuizData | null;
}

function useEditableList(initial: string[]) {
  const [items, setItems] = useState(initial.length > 0 ? initial : [""]);

  return {
    items,
    update: (index: number, value: string) => setItems((prev) => prev.map((v, i) => (i === index ? value : v))),
    add: () => setItems((prev) => [...prev, ""]),
    remove: (index: number) => setItems((prev) => prev.filter((_, i) => i !== index)),
  };
}

function EditableListField({
  label,
  placeholder,
  list,
}: {
  label: string;
  placeholder: string;
  list: ReturnType<typeof useEditableList>;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-2">
        {list.items.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={value} onChange={(e) => list.update(i, e.target.value)} placeholder={placeholder} />
            <button
              type="button"
              onClick={() => list.remove(i)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-white/10"
              aria-label="Remover"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={list.add}
        className="mt-2 flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      >
        <Plus size={14} /> Adicionar item
      </button>
    </div>
  );
}

// Antes era um único <Card> gigante com tudo lá dentro — agora dividido em
// cards por assunto (Detalhes e preço / Marketing / Colaboração / Quiz
// final), mesma ideia da própria página da aula (conteúdo em cards
// separados, não um formulário só). Continua um único <form>/pedido ao
// guardar — as cards são só organização visual.
export function CourseDetailsForm({ course, otherCourses }: { course: CourseData; otherCourses: { id: string; title: string }[] }) {
  const router = useRouter();
  const { fadeNavigate, setNavigationGuard } = useFadeNav();
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [category, setCategory] = useState(course.category);
  const [level, setLevel] = useState(course.level);
  const [price, setPrice] = useState(String(course.price));
  const [originalPrice, setOriginalPrice] = useState(course.originalPrice != null ? String(course.originalPrice) : "");
  const [trailerUrl, setTrailerUrl] = useState(course.trailerUrl);
  const outcomes = useEditableList(course.learningOutcomes);
  const requirements = useEditableList(course.requirements);
  const audience = useEditableList(course.targetAudience);
  const topics = useEditableList(course.topics);
  const [bundleName, setBundleName] = useState(course.bundle?.name ?? "");
  const [bundleCourseIds, setBundleCourseIds] = useState<string[]>(
    course.bundle?.courses.map((c) => c.id).filter((id) => id !== course.id) ?? []
  );
  const [collaborators, setCollaborators] = useState(course.collaborators);
  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [dirty, setDirty] = useState(false);
  const skipDirtyRef = useRef(true);
  useEffect(() => {
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    setDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    description,
    category,
    level,
    price,
    originalPrice,
    trailerUrl,
    outcomes.items,
    requirements.items,
    audience.items,
    topics.items,
    bundleName,
    bundleCourseIds,
    collaborators,
  ]);
  useUnsavedChangesGuard(dirty);

  function toggleBundleCourse(id: string) {
    setBundleCourseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addCollaborator() {
    const email = newCollaboratorEmail.trim();
    if (!email) return;
    if (email.toLowerCase() === course.instructor.email.toLowerCase()) return;
    if (collaborators.some((c) => c.email.toLowerCase() === email.toLowerCase())) return;
    setCollaborators((prev) => [...prev, { id: email, name: email, email }]);
    setNewCollaboratorEmail("");
  }

  function removeCollaborator(email: string) {
    setCollaborators((prev) => prev.filter((c) => c.email !== email));
  }

  async function save(overrides: Record<string, unknown> = {}, redirectAfter = false) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/instructor/courses/${course.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        category,
        level,
        price: Number(price) || 0,
        originalPrice: originalPrice.trim() === "" ? null : Number(originalPrice) || 0,
        trailerUrl,
        learningOutcomes: outcomes.items.map((o) => o.trim()).filter(Boolean),
        requirements: requirements.items.map((r) => r.trim()).filter(Boolean),
        targetAudience: audience.items.map((a) => a.trim()).filter(Boolean),
        topics: topics.items.map((t) => t.trim()).filter(Boolean),
        bundle: bundleName.trim() ? { name: bundleName.trim(), courseIds: bundleCourseIds } : null,
        collaboratorEmails: collaborators.map((c) => c.email),
        ...overrides,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar");
      return;
    }
    setDirty(false);
    if (redirectAfter) {
      // setDirty(false) só limpa o guard no próximo render (useEffect em
      // useUnsavedChangesGuard) — fadeNavigate a seguir, na mesma função
      // síncrona, ainda o via desatualizado (dirty) e perguntava "sair sem
      // guardar?" logo depois de ter acabado de guardar. Limpa já, direto.
      setNavigationGuard(null);
      fadeNavigate("/instructor");
    } else {
      router.refresh();
    }
  }

  async function handleDelete() {
    const res = await fetch(`/api/instructor/courses/${course.id}`, { method: "DELETE" });
    if (res.ok) router.push("/instructor");
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Editar curso
        </p>
        <h1 className="mt-2 truncate text-2xl font-bold text-slate-900 dark:text-white">
          {title || "Sem título"}
        </h1>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={course.published ? "success" : "warning"}>
            {course.published ? "Publicado" : "Rascunho"}
          </Badge>
          {course.ratingCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <Star size={12} className="fill-slate-800 text-slate-800 dark:fill-slate-200 dark:text-slate-200" />
              {course.rating.toFixed(1)} ({course.ratingCount} avaliações)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="submit" form="course-form" variant="premium" disabled={saving}>
            {saving ? "A guardar..." : "Guardar alterações"}
          </Button>
        </div>
      </div>

      <form
        id="course-form"
        onSubmit={(e) => {
          e.preventDefault();
          save({}, true);
        }}
        className="space-y-4"
      >
        <Card className="space-y-4 p-6">
          <h2 className="font-medium">Detalhes e preço</h2>
          <div>
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="level">Nível</Label>
              <select
                id="level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="beginner">Iniciante</option>
                <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="intermediate">Intermédio</option>
                <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white" value="advanced">Avançado</option>
              </select>
            </div>
            <div>
              <Label htmlFor="price">Preço (€, 0 = grátis)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="originalPrice">Preço original (€, opcional)</Label>
              <Input
                id="originalPrice"
                type="number"
                min={0}
                step="0.01"
                placeholder="Ex.: 59.99"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="font-medium">Marketing</h2>
          <div>
            <Label>Trailer do curso</Label>
            <FileUploadInput kind="VIDEO" onUploaded={(r) => setTrailerUrl(r.url)} />
            <p className="my-1.5 text-center text-xs text-slate-400 dark:text-slate-500">ou</p>
            <Input
              placeholder="Colar link do YouTube (https://youtube.com/watch?v=...)"
              defaultValue={trailerUrl?.includes("youtu") ? trailerUrl : ""}
              onBlur={(e) => e.target.value && setTrailerUrl(e.target.value)}
            />
            {trailerUrl && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Trailer atual: {trailerUrl}</p>}
          </div>

          <EditableListField label="O que os alunos vão aprender" placeholder="Ex.: Fundamentos práticos" list={outcomes} />
          <EditableListField label="Requisitos" placeholder="Ex.: Conhecimentos básicos de JavaScript" list={requirements} />
          <EditableListField label="Para quem é este curso" placeholder="Ex.: Iniciantes que querem mudar de carreira" list={audience} />
          <EditableListField label="Tópicos relacionados" placeholder="Ex.: React, TypeScript, APIs" list={topics} />
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="font-medium">Colaboração</h2>
          <div>
            <Label>Bundle (comprados frequentemente em conjunto)</Label>
            <Input
              placeholder="Nome do bundle, ex.: Pacote Data Science Completo"
              value={bundleName}
              onChange={(e) => setBundleName(e.target.value)}
            />
            {bundleName.trim() && (
              <div className="mt-2 space-y-1.5 rounded-md border border-slate-200 p-3 dark:border-white/10">
                {otherCourses.length === 0 ? (
                  <p className="text-xs text-slate-500">Não tens outros cursos publicados para incluir no bundle.</p>
                ) : (
                  otherCourses.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={bundleCourseIds.includes(c.id)}
                        onChange={() => toggleBundleCourse(c.id)}
                        className="rounded border-slate-300"
                      />
                      {c.title}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <Label>Colaboradores (co-autores deste curso)</Label>
            <p className="mb-2 text-xs text-slate-500">
              Colaboradores ganham acesso total de edição a este curso, tal como tu.
            </p>
            <div className="space-y-1.5">
              {collaborators.map((c) => (
                <div
                  key={c.email}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm dark:border-white/10"
                >
                  <span className="min-w-0 truncate">{c.name !== c.email ? `${c.name} (${c.email})` : c.email}</span>
                  <button
                    type="button"
                    onClick={() => removeCollaborator(c.email)}
                    className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={newCollaboratorEmail}
                onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCollaborator();
                  }
                }}
                className="min-w-0 flex-1 basis-40"
              />
              <Button type="button" variant="outline" onClick={addCollaborator}>
                Adicionar
              </Button>
            </div>
          </div>
        </Card>
      </form>

      {mounted &&
        document.getElementById("course-save-anchor") &&
        createPortal(
          <div className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-white/10">
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => save({ published: !course.published })} disabled={saving}>
                {course.published ? "Despublicar" : "Publicar"}
              </Button>
              <DeleteWithConfirmName
                name={course.title}
                label="Eliminar curso"
                confirmingLabel="A eliminar curso..."
                onConfirm={handleDelete}
              />
            </div>
          </div>,
          document.getElementById("course-save-anchor")!
        )}
    </div>
  );
}
