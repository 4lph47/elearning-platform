"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  CornerCard,
  CornerCardStack,
  CornerCardButtonNeutral,
  CornerCardButtonPrimary,
  CornerCardIssueList,
  focusField,
  type CornerCardIssue,
} from "@/components/ui/CornerCard";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Toggle } from "@/components/ui/Toggle";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { FileUploadInput, type ResumableFinalize } from "@/components/instructor/FileUploadInput";
import { LessonPlayer } from "@/components/player/LessonPlayer";
import { QuizEditor } from "@/components/instructor/QuizEditor";
import { LessonResourcesCard } from "@/components/instructor/LessonResourcesCard";
import { useFadeNav } from "@/components/course/FadeNavContext";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";
import { saveDraft, loadDraft, clearDraft, sanitizeUploadedUrl } from "@/lib/formDraft";
import { captureFirstFrame, uploadThumbnailBlob } from "@/lib/videoThumbnail";
import type { LessonData } from "@/components/instructor/LessonRow";

// Nomes de campo do lessonSchema (lib/validations.ts) nem sempre batem certo
// com os ids do DOM aqui em baixo (ex.: "title" -> id="lesson-title") — este
// mapa traduz um pro outro pro clique num item de "Falta preencher" (ver
// focusField em components/ui/CornerCard.tsx) saltar pro sítio certo.
const LESSON_FIELD_ID: Record<string, string> = {
  title: "lesson-title",
  description: "lesson-description",
  textContent: "lesson-text",
};
function focusLessonField(field: string) {
  focusField(LESSON_FIELD_ID[field] ?? field);
}

interface LessonDraft {
  title: string;
  description: string;
  isFreePreview: boolean;
  type: "VIDEO" | "TEXT";
  contentUrl: string | null;
  contentName: string | null;
  thumbnailUrl: string | null;
  thumbnailName: string | null;
  captionsUrl: string | null;
  textContent: string;
  contributorIds: string[];
  // Compressão de vídeo ainda em curso no worker quando este rascunho foi
  // gravado (ver onFinalizePending em FileUploadInput.tsx) — se presente,
  // reabrir esta aula retoma sozinho o acompanhamento, sem pedir o
  // ficheiro outra vez (o worker continua a comprimir independentemente
  // da aba estar aberta ou não; isto só serve pro CLIENTE voltar a saber
  // disso).
  pendingVideoUpload: ResumableFinalize | null;
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
  stats,
}: {
  courseId: string;
  moduleId: string;
  lesson?: LessonData;
  initialType?: "VIDEO" | "TEXT";
  nextOrder: number;
  courseAuthors: { id: string; name: string }[];
  stats?: { viewCount: number; commentsCount: number };
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
  const [contentUrl, setContentUrl] = useState<string | null>(
    sanitizeUploadedUrl(draft?.value.contentUrl ?? lesson?.contentUrl)
  );
  const [contentName, setContentName] = useState<string | null>(draft?.value.contentName ?? null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    sanitizeUploadedUrl(draft?.value.thumbnailUrl ?? lesson?.thumbnailUrl)
  );
  const [thumbnailName, setThumbnailName] = useState<string | null>(draft?.value.thumbnailName ?? null);
  // true só enquanto o thumbnail atual veio do frame capturado automaticamente
  // (não de uma escolha manual) — decide se um novo vídeo pode substituí-lo.
  const [thumbnailIsAuto, setThumbnailIsAuto] = useState(false);
  const [captionsUrl, setCaptionsUrl] = useState<string | null>(
    sanitizeUploadedUrl(draft?.value.captionsUrl ?? lesson?.captionsUrl)
  );
  // Espelha o stage interno do FileUploadInput do vídeo (ver onStageChange)
  // — legendas são geradas no worker (ver worker/index.js:transcribeToVtt),
  // não no browser, por isso "transcribing" é só mais um valor reportado
  // pelo servidor, igual a "compressing". Só serve pro stepper de 3 etapas
  // acima do input, não guarda mais nenhuma lógica própria.
  const [videoStage, setVideoStage] = useState<"uploading" | "compressing" | "transcribing" | null>(null);
  const [videoStagePercent, setVideoStagePercent] = useState<number | null>(null);
  const [pendingVideoUpload, setPendingVideoUpload] = useState<ResumableFinalize | null>(
    draft?.value.pendingVideoUpload ?? null
  );
  const [textContent, setTextContent] = useState(draft?.value.textContent ?? lesson?.textContent ?? "");
  const [contributorIds, setContributorIds] = useState<string[]>(
    draft?.value.contributorIds ?? lesson?.contributors?.map((c) => c.id) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [saveIssues, setSaveIssues] = useState<CornerCardIssue[] | null>(null);

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
      contentName,
      thumbnailUrl,
      thumbnailName,
      captionsUrl,
      textContent,
      contributorIds,
      pendingVideoUpload,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    description,
    isFreePreview,
    type,
    contentUrl,
    contentName,
    thumbnailUrl,
    thumbnailName,
    captionsUrl,
    textContent,
    pendingVideoUpload,
    contributorIds,
  ]);
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

  // URL local (blob) do ficheiro escolhido — dá pra tocar no preview
  // enquanto o upload/compressão ainda vão a caminho, sem esperar pelo
  // vídeo comprimido do worker. Só existe na memória desta aba (não é
  // persistido em rascunho nenhum, ao contrário de pendingVideoUpload) —
  // some com um refresh, altura em que o preview volta a ficar em branco
  // até o vídeo real (contentUrl) ficar pronto.
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const localPreviewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (localPreviewUrlRef.current) URL.revokeObjectURL(localPreviewUrlRef.current);
    };
  }, []);
  function handleVideoFileSelected(file: File) {
    if (localPreviewUrlRef.current) URL.revokeObjectURL(localPreviewUrlRef.current);
    const url = URL.createObjectURL(file);
    localPreviewUrlRef.current = url;
    setLocalPreviewUrl(url);
    // Thumbnail corre já, no browser (não depende da compressão). Legendas
    // já não correm aqui — o worker gera-as sozinho a seguir à compressão
    // (ver worker/index.js:transcribeToVtt) e devolve o URL delas no
    // onUploaded, junto com o do vídeo.
    handleGenerateThumbnail(file);
  }

  // Gera o thumbnail da aula a partir do 1º frame do vídeo, e só quando o
  // instrutor ainda não escolheu um à mão (thumbnailUrl vazio, ou o atual
  // também é auto de um vídeo anterior). Isto é o que faz o thumbnail do
  // curso (syncCourseThumbnail usa o thumbnail da 1ª aula) e o trailer
  // (fallback em app/courses/[slug] e afins usa o contentUrl da 1ª aula)
  // ficarem preenchidos sozinhos quando o instrutor não define nada
  // manualmente. generationRef evita que o resultado de uma captura ANTIGA
  // (ficheiro trocado a meio) sobrescreva o estado depois de já não ser
  // relevante.
  const thumbnailGenerationRef = useRef(0);
  async function handleGenerateThumbnail(file: File) {
    if (thumbnailUrl && !thumbnailIsAuto) return;
    const myGeneration = ++thumbnailGenerationRef.current;
    const isCurrent = () => thumbnailGenerationRef.current === myGeneration;
    try {
      const blob = await captureFirstFrame(file);
      if (!isCurrent()) return;
      const { url, name } = await uploadThumbnailBlob(blob);
      if (!isCurrent()) return;
      setThumbnailUrl(url);
      setThumbnailName(name);
      setThumbnailIsAuto(true);
    } catch (err) {
      if (!isCurrent()) return;
      console.error("Falha ao gerar thumbnail automático:", err);
    }
  }

  // Pipeline do vídeo: enviar -> comprimir -> legendas, tudo reportado pelo
  // worker via onStageChange (FileUploadInput.tsx) — o stepper só aparece
  // enquanto alguma das 3 etapas está mesmo a decorrer, nada antes do
  // upload arrancar nem depois de "transcribing" acabar (videoStage volta
  // a null).
  const videoPipelineStep = videoStage === "uploading" ? 1 : videoStage === "compressing" ? 2 : videoStage === "transcribing" ? 3 : null;
  const VIDEO_PIPELINE_STEPS = ["Enviar vídeo", "Comprimir vídeo", "Gerar legendas"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveIssues(null);

    if (type === "VIDEO" && !contentUrl) {
      setSaveIssues([{ message: "Envia o vídeo desta aula antes de guardar", field: "contentUrl" }]);
      return;
    }
    if (type === "TEXT" && !textContent.trim()) {
      setSaveIssues([{ message: "Escreve o conteúdo desta aula antes de guardar", field: "textContent" }]);
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
      captionsUrl: type === "VIDEO" ? captionsUrl : null,
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
      setSaveIssues(data.issues ?? [{ message: data.error ?? "Erro ao guardar aula" }]);
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
            <CornerCardIssueList issues={saveIssues} onIssueClick={focusLessonField} />
          </CornerCard>
        )}
      </CornerCardStack>

      <div className="space-y-3 border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {isEditing ? "Editar aula" : "Nova aula"}
          </p>
          <h1 className="mt-2 break-words text-2xl font-bold text-slate-900 dark:text-white">
            {title || "Sem título"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {stats && (
              <>
                <span className="flex items-center gap-1">
                  <Eye size={12} />
                  {stats.viewCount} visualizações
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle size={12} />
                  {stats.commentsCount} comentários
                </span>
              </>
            )}
          </div>
          <Button type="submit" form="lesson-form" variant="premium" disabled={saving}>
            {saving ? "A guardar..." : "Guardar aula"}
          </Button>
        </div>
      </div>

      {/* Colunas independentes (flex, não grid) — Recursos/Quiz continuam
          diretamente por baixo de Detalhes/Conteúdo na MESMA coluna, sem
          depender da altura da coluna do lado (um grid empilhado em duas
          fiadas separadas fazia a 2ª fiada começar só depois da fiada
          INTEIRA anterior acabar, não da card diretamente acima). Recursos/
          Quiz não fazem parte da submissão deste form (têm o próprio fetch
          cada um), só ficam visualmente na mesma coluna. */}
      <form id="lesson-form" onSubmit={handleSubmit}>
        <div className="lg:flex lg:items-start lg:gap-4">
        <div className="space-y-4 lg:flex-1">
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

            <Toggle
              id="lesson-free-preview"
              checked={isFreePreview}
              onChange={setIsFreePreview}
              labelPosition="left"
              label="Aula disponível como preview grátis (sem matrícula)"
            />

            {courseAuthors.length > 1 && (
              <div>
                <Label>Envolvidos nesta aula</Label>
                <div className="space-y-1">
                  {courseAuthors.map((a) => (
                    <Toggle
                      key={a.id}
                      id={`lesson-contributor-${a.id}`}
                      checked={contributorIds.includes(a.id)}
                      onChange={() => toggleContributor(a.id)}
                      labelPosition="left"
                      label={a.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </CollapsibleCard>
          {isEditing && <LessonResourcesCard lessonId={lesson!.id} initialResources={lesson!.resources} />}
        </div>

        <div className="mt-4 space-y-4 lg:mt-0 lg:flex-1">
          <CollapsibleCard title="Conteúdo">
            {type === "VIDEO" ? (
              <div id="contentUrl" className="space-y-2">
                <Label>Vídeo da aula (obrigatório)</Label>
                {videoPipelineStep !== null && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {VIDEO_PIPELINE_STEPS.map((stepLabel, i) => {
                      const stepNumber = i + 1;
                      const isDone = stepNumber < videoPipelineStep;
                      const isCurrentStep = stepNumber === videoPipelineStep;
                      return (
                        <div key={stepLabel} className="flex items-center gap-2">
                          {i > 0 && <span className="text-slate-300 dark:text-white/20">→</span>}
                          <span
                            className={
                              isCurrentStep
                                ? "font-medium text-blue-600 dark:text-blue-400"
                                : isDone
                                  ? "text-slate-400 line-through dark:text-slate-500"
                                  : ""
                            }
                          >
                            {stepNumber}. {stepLabel}
                            {isCurrentStep && stepNumber !== 1 && videoStagePercent !== null && ` (${videoStagePercent}%)`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <FileUploadInput
                  kind="VIDEO"
                  currentUrl={contentUrl}
                  currentName={contentName}
                  onStageChange={(stage, percent) => {
                    setVideoStage(stage);
                    setVideoStagePercent(percent);
                  }}
                  onUploaded={(r) => {
                    if (localPreviewUrlRef.current) {
                      URL.revokeObjectURL(localPreviewUrlRef.current);
                      localPreviewUrlRef.current = null;
                    }
                    setLocalPreviewUrl(null);
                    setContentUrl(r.url);
                    setContentName(r.name);
                    // Gerado (ou não, ver worker/index.js:startFinalizeJob)
                    // pelo worker a seguir à compressão — nunca falha o
                    // upload em si, só fica null se a transcrição não correu.
                    setCaptionsUrl(r.captionsUrl ?? null);
                  }}
                  onFileSelected={handleVideoFileSelected}
                  resumeUpload={pendingVideoUpload}
                  onFinalizePending={setPendingVideoUpload}
                />
                {/* Preview do conteúdo ANTES de clicar em mais lado nenhum —
                    mesmo LessonPlayer usado na aula a sério (gestos, seletor
                    de qualidade, tudo igual), só que a largura fica fluida
                    (fluidWidth) em vez das larguras fixas da página da aula,
                    que não cabiam nesta card mais estreita. */}
                {contentUrl ? (
                  <div className="mt-2 overflow-hidden rounded-md bg-black">
                    <LessonPlayer
                      lessonId={lesson?.id ?? "preview"}
                      type="VIDEO"
                      contentUrl={contentUrl}
                      hlsMasterUrl={previewHlsMasterUrl}
                      captionsUrl={captionsUrl}
                      initialWatchedSeconds={0}
                      onComplete={() => {}}
                      fluidWidth
                    />
                  </div>
                ) : (
                  localPreviewUrl && (
                    // Vídeo comprimido ainda não está pronto — toca o
                    // ficheiro local diretamente (sem hls.js, é o
                    // ficheiro bruto tal como escolhido) em vez de
                    // deixar o preview em branco até o worker acabar.
                    <div className="mt-2 overflow-hidden rounded-md bg-black">
                      <video src={localPreviewUrl} controls className="aspect-video w-full" />
                    </div>
                  )
                )}
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
          {type === "VIDEO" && (
            <CollapsibleCard title="Thumbnail">
              <div id="thumbnailUrl">
                <Label>Thumbnail da aula (opcional)</Label>
                <p className="mb-1.5 text-xs text-slate-400 dark:text-slate-500">
                  O thumbnail da primeira aula do curso é o que aparece nos cards (página principal, catálogo, etc.).
                </p>
                <FileUploadInput
                  kind="IMAGE"
                  currentUrl={thumbnailUrl}
                  currentName={thumbnailName}
                  onUploaded={(r) => {
                    setThumbnailUrl(r.url);
                    setThumbnailName(r.name);
                    setThumbnailIsAuto(false);
                  }}
                />
                {thumbnailIsAuto && (
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Gerado automaticamente a partir do vídeo.
                  </p>
                )}
                {thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnailUrl}
                    alt="Pré-visualização do thumbnail"
                    className="mt-2 aspect-video w-full rounded-md object-cover"
                  />
                )}
              </div>
            </CollapsibleCard>
          )}
          {isEditing && type === "VIDEO" && (
            <CollapsibleCard title="Quiz da aula">
              <QuizEditor scope="LESSON" parentId={lesson!.id} label="Quiz da aula" existingQuiz={lesson?.quiz} />
            </CollapsibleCard>
          )}
        </div>
        </div>
      </form>
    </div>
  );
}
