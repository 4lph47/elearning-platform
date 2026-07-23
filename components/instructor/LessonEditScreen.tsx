"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CornerCard, CornerCardStack, CornerCardButtonNeutral, CornerCardButtonPrimary } from "@/components/ui/CornerCard";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { FileUploadInput } from "@/components/instructor/FileUploadInput";
import { LessonPlayer } from "@/components/player/LessonPlayer";
import { QuizEditor } from "@/components/instructor/QuizEditor";
import { LessonResourcesCard } from "@/components/instructor/LessonResourcesCard";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";
import { saveDraft, loadDraft, clearDraft } from "@/lib/formDraft";
import type { LessonData } from "@/components/instructor/LessonRow";

interface LessonDraft {
  title: string;
  description: string;
  isFreePreview: boolean;
  type: "VIDEO" | "TEXT";
  contentUrl: string | null;
  thumbnailUrl: string | null;
  textContent: string;
  contributorIds: string[];
}

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
  const { fadeNavigate, setNavigationGuard } = useFadeNav();
  const isEditing = Boolean(lesson);
  const backHref = `/instructor/courses/${courseId}`;
  const draftKey = `lesson-draft:${lesson?.id ?? `new-${moduleId}`}`;
  const [draft] = useState(() => loadDraft<LessonDraft>(draftKey));
  const [draftBannerVisible, setDraftBannerVisible] = useState(() => Boolean(draft));

  const [title, setTitle] = useState(draft?.value.title ?? lesson?.title ?? "");
  const [description, setDescription] = useState(draft?.value.description ?? lesson?.description ?? "");
  const [isFreePreview, setIsFreePreview] = useState(draft?.value.isFreePreview ?? lesson?.isFreePreview ?? false);
  const [type, setType] = useState<"VIDEO" | "TEXT">(draft?.value.type ?? lesson?.type ?? initialType ?? "VIDEO");
  const [contentUrl, setContentUrl] = useState<string | null>(draft?.value.contentUrl ?? lesson?.contentUrl ?? null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    draft?.value.thumbnailUrl ?? lesson?.thumbnailUrl ?? null
  );
  const [textContent, setTextContent] = useState(draft?.value.textContent ?? lesson?.textContent ?? "");
  const [contributorIds, setContributorIds] = useState<string[]>(
    draft?.value.contributorIds ?? lesson?.contributors?.map((c) => c.id) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [saveIssues, setSaveIssues] = useState<string[] | null>(null);

  const [dirty, setDirty] = useState(false);
  const skipDirtyRef = useRef(true);
  useEffect(() => {
    if (skipDirtyRef.current) {
      skipDirtyRef.current = false;
      return;
    }
    setDirty(true);
    saveDraft<LessonDraft>(draftKey, {
      title,
      description,
      isFreePreview,
      type,
      contentUrl,
      thumbnailUrl,
      textContent,
      contributorIds,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, isFreePreview, type, contentUrl, thumbnailUrl, textContent, contributorIds]);
  useUnsavedChangesGuard(dirty);

  function discardDraft() {
    clearDraft(draftKey);
    window.location.reload();
  }

  // Vídeo enviado agora (worker já comprimiu antes de devolver) já vem como
  // um master.m3u8 pronto — mesma marca usada em lib/videoTranscode.ts, mas
  // sem importar esse módulo aqui (arrasta o Prisma client pro bundle do
  // browser). Aula já gravada usa o hlsMasterUrl guardado na BD.
  const isHlsContent = Boolean(contentUrl?.endsWith("/master.m3u8"));
  const previewHlsMasterUrl = isHlsContent ? contentUrl : lesson?.hlsMasterUrl ?? null;

  function toggleContributor(id: string) {
    setContributorIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveIssues(null);

    if (type === "VIDEO" && !contentUrl) {
      setSaveIssues(["Envia o vídeo desta aula antes de guardar"]);
      return;
    }
    if (type === "TEXT" && !textContent.trim()) {
      setSaveIssues(["Escreve o conteúdo desta aula antes de guardar"]);
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
      setSaveIssues(data.issues ?? [data.error ?? "Erro ao guardar aula"]);
      return;
    }

    // Antes de navegar (fadeNavigate/router.refresh abaixo) — senão o guard
    // ainda via "dirty" e perguntava "sair sem guardar?" logo depois de ter
    // acabado de guardar com sucesso. setDirty(false) só limpa o guard no
    // próximo render (efeito em useUnsavedChangesGuard); fadeNavigate a
    // seguir, ainda síncrono, apanhava-o desatualizado — daí limpar direto
    // também.
    setDirty(false);
    clearDraft(draftKey);
    setNavigationGuard(null);

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

      <CornerCardStack>
        {draftBannerVisible && draft && (
          <CornerCard>
            <p className="text-slate-700 dark:text-slate-200">
              Restaurámos um rascunho não guardado de {new Date(draft.savedAt).toLocaleString("pt-PT")}.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <CornerCardButtonNeutral onClick={discardDraft}>Descartar</CornerCardButtonNeutral>
              <CornerCardButtonPrimary onClick={() => setDraftBannerVisible(false)}>
                Continuar com este rascunho
              </CornerCardButtonPrimary>
            </div>
          </CornerCard>
        )}

        {saveIssues && (
          <CornerCard>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-slate-900 dark:text-white">Falta preencher</p>
              <button
                type="button"
                onClick={() => setSaveIssues(null)}
                aria-label="Fechar"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X size={14} />
              </button>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-600 dark:text-slate-300">
              {saveIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </CornerCard>
        )}
      </CornerCardStack>

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

      <form id="lesson-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <CollapsibleCard title="Detalhes">
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
          </CollapsibleCard>

          <CollapsibleCard title="Conteúdo">
            {type === "VIDEO" ? (
              <div className="space-y-2">
                <Label>Vídeo da aula (obrigatório)</Label>
                <FileUploadInput kind="VIDEO" currentUrl={contentUrl} onUploaded={(r) => setContentUrl(r.url)} />
                {/* Preview do conteúdo ANTES de clicar em mais lado nenhum —
                    mesmo LessonPlayer usado na aula a sério (gestos, seletor
                    de qualidade, tudo igual), só que a largura fica fluida
                    (fluidWidth) em vez das larguras fixas da página da aula,
                    que não cabiam nesta card mais estreita. */}
                {contentUrl && (
                  <div className="mt-2 overflow-hidden rounded-md bg-black">
                    <LessonPlayer
                      lessonId={lesson?.id ?? "preview"}
                      type="VIDEO"
                      contentUrl={contentUrl}
                      hlsMasterUrl={previewHlsMasterUrl}
                      initialWatchedSeconds={0}
                      onComplete={() => {}}
                      fluidWidth
                    />
                  </div>
                )}

                <div>
                  <Label>Thumbnail da aula (opcional)</Label>
                  <p className="mb-1.5 text-xs text-slate-400 dark:text-slate-500">
                    O thumbnail da primeira aula do curso é o que aparece nos cards (página principal, catálogo, etc.).
                  </p>
                  <FileUploadInput kind="IMAGE" currentUrl={thumbnailUrl} onUploaded={(r) => setThumbnailUrl(r.url)} />
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
          </CollapsibleCard>
        </div>
      </form>

      {isEditing && (
        <div className="grid gap-4 lg:grid-cols-2">
          <LessonResourcesCard lessonId={lesson!.id} initialResources={lesson!.resources} />
          {type === "VIDEO" && (
            <CollapsibleCard title="Quiz da aula">
              <QuizEditor scope="LESSON" parentId={lesson!.id} label="Quiz da aula" existingQuiz={lesson?.quiz} />
            </CollapsibleCard>
          )}
        </div>
      )}
    </div>
  );
}
