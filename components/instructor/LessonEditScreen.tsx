"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { FileUploadInput } from "@/components/instructor/FileUploadInput";
import { QuizEditor } from "@/components/instructor/QuizEditor";
import { LessonResourcesCard } from "@/components/instructor/LessonResourcesCard";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { getYouTubeId } from "@/lib/youtube";
import type { LessonData } from "@/components/instructor/LessonRow";

// Tela dedicada (não painel a expandir por baixo da aula na lista) — conteúdo
// dividido em cards separados (Detalhes / Conteúdo / Recursos / Quiz da
// aula), igual ao layout lado-a-lado da própria página da aula no desktop.
export function LessonEditScreen({
  courseId,
  moduleId,
  lesson,
  initialType,
  nextOrder,
  courseAuthors,
}: {
  courseId: string;
  moduleId: string;
  lesson?: LessonData;
  initialType?: "VIDEO" | "TEXT";
  nextOrder: number;
  courseAuthors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { fadeNavigate } = useFadeNav();
  const isEditing = Boolean(lesson);
  const backHref = `/instructor/courses/${courseId}`;

  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [isFreePreview, setIsFreePreview] = useState(lesson?.isFreePreview ?? false);
  const [type, setType] = useState<"VIDEO" | "TEXT">(lesson?.type ?? initialType ?? "VIDEO");
  const [contentUrl, setContentUrl] = useState<string | null>(lesson?.contentUrl ?? null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(lesson?.thumbnailUrl ?? null);
  const [textContent, setTextContent] = useState(lesson?.textContent ?? "");
  const [contributorIds, setContributorIds] = useState<string[]>(lesson?.contributors?.map((c) => c.id) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const youtubeId = contentUrl ? getYouTubeId(contentUrl) : null;

  function toggleContributor(id: string) {
    setContributorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (type === "VIDEO" && !contentUrl) {
      setError("Envia o vídeo desta aula antes de guardar");
      return;
    }
    if (type === "TEXT" && !textContent.trim()) {
      setError("Escreve o conteúdo desta aula antes de guardar");
      return;
    }

    setSaving(true);
    const payload = {
      title,
      order: lesson?.order ?? nextOrder,
      isFreePreview,
      type,
      contentUrl: type === "VIDEO" ? contentUrl : null,
      thumbnailUrl: type === "VIDEO" ? thumbnailUrl : null,
      textContent: type === "TEXT" ? textContent : null,
      description: description.trim() || null,
      contributorIds,
    };

    const url = isEditing ? `/api/instructor/lessons/${lesson!.id}` : `/api/instructor/modules/${moduleId}/lessons`;
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao guardar aula");
      return;
    }

    if (isEditing) {
      fadeNavigate(backHref);
    } else {
      // Aula nova só ganha os cards de Recursos/Quiz depois de ter um id
      // (precisam de já existir na BD) — em vez de voltar ao curso, fica já
      // na própria aula recém-criada, onde esses cards aparecem.
      const created = await res.json();
      fadeNavigate(`/instructor/courses/${courseId}/modules/${moduleId}/lessons/${created.id}`);
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-1 py-10 sm:px-2">
      <Button variant="ghost" onClick={() => fadeNavigate(backHref)}>
        ← Voltar ao curso
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {isEditing ? "Editar aula" : "Nova aula"}
          </p>
          <h1 className="mt-2 truncate text-2xl font-bold text-slate-900 dark:text-white">
            {title || "Sem título"}
          </h1>
        </div>
        <Button type="submit" form="lesson-form" variant="premium" disabled={saving}>
          {saving ? "A guardar..." : "Guardar aula"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <form id="lesson-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-4">
            <h2 className="font-medium">Detalhes</h2>
            <div>
              <Label htmlFor="lesson-title">Título da aula</Label>
              <Input id="lesson-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <Label>Tipo de aula</Label>
              <div className="flex gap-2">
                {(["VIDEO", "TEXT"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-sm ${
                      type === t
                        ? "border-slate-800 bg-slate-900 text-white dark:border-slate-600 dark:bg-slate-700"
                        : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
                    }`}
                  >
                    {t === "VIDEO" ? "Vídeo" : "Texto"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="lesson-description">Descrição da aula (opcional)</Label>
              <Textarea
                id="lesson-description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isFreePreview}
                onChange={(e) => setIsFreePreview(e.target.checked)}
                className="rounded border-slate-300"
              />
              Aula disponível como preview grátis (sem matrícula)
            </label>

            {courseAuthors.length > 1 && (
              <div>
                <Label>Envolvidos nesta aula</Label>
                <div className="space-y-1">
                  {courseAuthors.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={contributorIds.includes(a.id)}
                        onChange={() => toggleContributor(a.id)}
                        className="rounded border-slate-300"
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <h2 className="font-medium">Conteúdo</h2>
            {type === "VIDEO" ? (
              <div className="space-y-2">
                <Label>Vídeo da aula (obrigatório)</Label>
                <FileUploadInput kind="VIDEO" onUploaded={(r) => setContentUrl(r.url)} />
                <p className="text-center text-xs text-slate-400 dark:text-slate-500">ou</p>
                <Input
                  placeholder="Colar link do YouTube (https://youtube.com/watch?v=...)"
                  defaultValue={contentUrl?.includes("youtu") ? contentUrl : ""}
                  onBlur={(e) => e.target.value && setContentUrl(e.target.value)}
                />
                {/* Preview do conteúdo ANTES de clicar em mais lado nenhum —
                    vídeo real (nativo) ou embed do YouTube, logo que haja URL. */}
                {contentUrl && (
                  <div className="mt-2 overflow-hidden rounded-md bg-black">
                    {youtubeId ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${youtubeId}`}
                        title="Preview do vídeo"
                        allow="encrypted-media"
                        className="aspect-video w-full"
                      />
                    ) : (
                      <video src={contentUrl} controls className="aspect-video w-full bg-black" />
                    )}
                  </div>
                )}

                <div>
                  <Label>Thumbnail da aula (opcional)</Label>
                  <p className="mb-1.5 text-xs text-slate-400 dark:text-slate-500">
                    O thumbnail da primeira aula do curso é o que aparece nos cards (página principal, catálogo, etc.).
                  </p>
                  <FileUploadInput kind="IMAGE" onUploaded={(r) => setThumbnailUrl(r.url)} />
                  {thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl}
                      alt="Pré-visualização do thumbnail"
                      className="mt-2 aspect-video w-full rounded-md object-cover"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="lesson-text">Conteúdo da aula (obrigatório)</Label>
                <Textarea
                  id="lesson-text"
                  rows={8}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Escreve o conteúdo desta aula em texto..."
                />
                {textContent.trim() && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-400 dark:text-slate-500">Pré-visualização</p>
                    <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                        {textContent}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </form>

      {isEditing && (
        <div className="grid gap-4 lg:grid-cols-2">
          <LessonResourcesCard lessonId={lesson!.id} initialResources={lesson!.resources} />
          {type === "VIDEO" && (
            <Card className="p-4">
              <h2 className="mb-3 font-medium">Quiz da aula</h2>
              <QuizEditor scope="LESSON" parentId={lesson!.id} label="Quiz da aula" existingQuiz={lesson?.quiz} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
