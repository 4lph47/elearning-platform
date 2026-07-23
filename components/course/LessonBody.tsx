"use client";

import { useEffect, useRef, useState, cloneElement, type ReactElement } from "react";
import { ArrowLeft, ArrowRight, X, Maximize2, Minimize2, Check, CircleCheck } from "lucide-react";
import { useSwipeNav } from "@/lib/useSwipeNav";
import { LessonPlayer } from "@/components/player/LessonPlayer";
import { LessonTabs, type LessonResourceData, type VideoMeta } from "@/components/course/LessonTabs";
import { useChatOpen, useSidebarCollapsed } from "@/components/course/ChatOpenContext";
import { ResourcePreviewContent as PreviewContent } from "@/components/course/ResourcePreviewContent";
import { boxFromRect, useCardTransition } from "@/components/course/CardTransitionContext";

export function LessonBody({
  title,
  courseSlug,
  lessonId,
  type,
  contentUrl,
  textContent,
  initialCompleted,
  initialWatchedSeconds,
  overview,
  resources,
  progress,
  engagement,
  comments,
  videoMeta,
  previousHref,
  previousTitle,
  nextHref,
  nextTitle,
}: {
  title: React.ReactNode;
  courseSlug: string;
  lessonId: string;
  type: "VIDEO" | "TEXT";
  contentUrl: string | null;
  textContent?: string | null;
  initialCompleted: boolean;
  initialWatchedSeconds: number;
  overview: string;
  resources: LessonResourceData[];
  progress?: React.ReactNode;
  engagement?: ReactElement<{ completeButton?: React.ReactNode }>;
  comments?: React.ReactNode;
  videoMeta?: VideoMeta;
  previousHref?: string | null;
  previousTitle?: string | null;
  nextHref?: string | null;
  nextTitle?: string | null;
}) {
  const chatOpen = useChatOpen();
  const collapsed = useSidebarCollapsed();
  const [previewResource, setPreviewResource] = useState<LessonResourceData | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [completed, setCompleted] = useState(initialCompleted);
  const [cinemaMode, setCinemaMode] = useState(false);
  const { handleTouchStart, handleTouchEnd, swipeClassName, goPrevious, goNext, showSpinner } = useSwipeNav(
    previousHref,
    nextHref
  );
  const sideBySide = !chatOpen;
  const inlinePreview = sideBySide && previewResource !== null;
  const inlinePreviewHeight = collapsed ? "h-[88vh]" : "h-[70vh]";
  const belowVideoWidth = `lg:max-w-none ${collapsed ? "lg:w-[1080px]" : "lg:w-[800px]"}`;

  const playerBoxRef = useRef<HTMLDivElement>(null);
  const { state, arrive } = useCardTransition();
  const pending = state?.slug === courseSlug && !state.arrived;

  // Recebe o vídeo a voar de um card "Continuar onde paraste" (página
  // principal) clicado diretamente para esta aula — ver CourseTile.tsx.
  useEffect(() => {
    if (!pending) return;
    const rect = playerBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    arrive(courseSlug, { video: boxFromRect(rect), title: null, category: null, instructor: null, rating: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, courseSlug]);

  function closePreview() {
    setPreviewResource(null);
    setMaximized(false);
  }

  async function markComplete() {
    if (completed) return;
    setCompleted(true);
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, completed: true }),
    });
  }

  const completeButton = (
    <button
      onClick={markComplete}
      disabled={completed}
      aria-label={completed ? "Aula concluída" : "Marcar como concluída"}
      title={completed ? "Aula concluída" : "Marcar como concluída"}
      className="shrink-0 disabled:cursor-default"
    >
      {completed ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
          <Check size={14} strokeWidth={3} className="text-white" />
        </span>
      ) : (
        <CircleCheck size={22} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" />
      )}
    </button>
  );

  const engagementWithButton = engagement && cloneElement(engagement, { completeButton });

  return (
    <div className="overflow-x-hidden">
    {showSpinner && (
      <div className="pointer-events-none fixed inset-0 z-[998] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-white/15 dark:border-t-white/70" />
      </div>
    )}
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className={swipeClassName}>
      <div className="flex items-center justify-between">
        {previousHref && (
          <button
            type="button"
            onClick={goPrevious}
            className="inline-flex min-w-0 items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft size={14} className="shrink-0" />
            <span className="truncate">
              Aula anterior{previousTitle && <span className="hidden sm:inline">: {previousTitle}</span>}
            </span>
          </button>
        )}
        {nextHref && (
          <button
            type="button"
            onClick={goNext}
            className="ml-auto inline-flex min-w-0 items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            <span className="truncate">
              Próxima aula{nextTitle && <span className="hidden sm:inline">: {nextTitle}</span>}
            </span>
            <ArrowRight size={14} className="shrink-0" />
          </button>
        )}
      </div>

      <div className="mt-4">
        <div className={sideBySide ? "lg:flex lg:items-stretch lg:gap-6" : ""}>
          <div ref={playerBoxRef} className="lg:shrink-0">
            <LessonPlayer
              lessonId={lessonId}
              type={type}
              contentUrl={contentUrl}
              textContent={textContent}
              initialWatchedSeconds={initialWatchedSeconds}
              onComplete={markComplete}
              cinemaMode={cinemaMode}
              onToggleCinemaMode={type === "VIDEO" ? () => setCinemaMode((c) => !c) : undefined}
            />
          </div>

          <div className="mt-4 lg:hidden">
            {title}
            {engagementWithButton && <div className="mt-3">{engagementWithButton}</div>}
          </div>

          <div className={sideBySide ? "mt-6 lg:mt-0 lg:min-w-0 lg:flex-1" : ""}>
            {inlinePreview ? (
              <div className={`relative overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-neutral-900 ${inlinePreviewHeight}`}>
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
                  <button
                    onClick={() => setMaximized(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Maximizar preview"
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button
                    onClick={closePreview}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Fechar preview"
                  >
                    <X size={14} />
                  </button>
                </div>
                <PreviewContent resource={previewResource} />
              </div>
            ) : (
              <LessonTabs
                overview={overview}
                resources={resources}
                progress={progress}
                comments={comments}
                videoMeta={videoMeta}
                onSelectResource={(r) => setPreviewResource((prev) => (prev?.id === r.id ? null : r))}
              />
            )}
          </div>
        </div>

        {!sideBySide && previewResource && (
          <div className="relative mt-3 h-[80vh] w-full overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-neutral-900">
            <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
              <button
                onClick={() => setMaximized(true)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Maximizar preview"
              >
                <Maximize2 size={13} />
              </button>
              <button
                onClick={closePreview}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Fechar preview"
              >
                <X size={14} />
              </button>
            </div>
            <PreviewContent resource={previewResource} />
          </div>
        )}

        <div className={belowVideoWidth}>
          <div className="mt-4 hidden lg:block">
            {title}
            {engagementWithButton && <div className="mt-3">{engagementWithButton}</div>}
          </div>

          <div className="hidden lg:block">{comments}</div>
        </div>
      </div>

      {previewResource && maximized && (
        <div className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-neutral-900 lg:inset-10">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{previewResource.name}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMaximized(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                aria-label="Restaurar preview"
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={closePreview}
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                aria-label="Fechar preview"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="relative flex-1">
            <PreviewContent resource={previewResource} />
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
