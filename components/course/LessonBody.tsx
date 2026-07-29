"use client";

import { useEffect, useRef, useState, cloneElement, type ReactElement } from "react";
import { ArrowLeft, ArrowRight, X, Maximize2, Minimize2, Check, CircleCheck } from "lucide-react";
import { useSwipeNav } from "@/lib/useSwipeNav";
import { LessonPlayer, type VideoRendition } from "@/components/player/LessonPlayer";
import { LessonTabs, type LessonResourceData, type VideoMeta } from "@/components/course/LessonTabs";
import type { LessonEngagementBarHandle } from "@/components/course/LessonEngagementBar";
import { useChatOpen, useSidebarCollapsed } from "@/components/course/ChatOpenContext";
import { ResourcePreviewContent as PreviewContent } from "@/components/course/ResourcePreviewContent";
import { boxFromRect, useCardTransition } from "@/components/course/CardTransitionContext";
import { getStoredAmbient, setStoredAmbient } from "@/lib/playerPreferences";

const SWIPE_HINT_SEEN_KEY = "lessonSwipeHintSeen";

export function LessonBody({
  title,
  courseSlug,
  lessonId,
  type,
  contentUrl,
  hlsMasterUrl,
  captionsUrl,
  videoRenditions,
  textContent,
  initialCompleted,
  initialWatchedSeconds,
  overview,
  resources,
  progress,
  engagement,
  comments,
  notes,
  videoMeta,
  previousHref,
  previousTitle,
  nextHref,
  nextTitle,
  autoplayNext,
}: {
  title: React.ReactNode;
  courseSlug: string;
  lessonId: string;
  type: "VIDEO" | "TEXT";
  contentUrl: string | null;
  hlsMasterUrl?: string | null;
  captionsUrl?: string | null;
  videoRenditions?: VideoRendition[];
  textContent?: string | null;
  initialCompleted: boolean;
  initialWatchedSeconds: number;
  overview: string;
  resources: LessonResourceData[];
  progress?: React.ReactNode;
  engagement?: ReactElement<{ completeButton?: React.ReactNode; onReady?: (handle: LessonEngagementBarHandle) => void }>;
  comments?: React.ReactNode;
  notes?: React.ReactNode;
  videoMeta?: VideoMeta;
  previousHref?: string | null;
  previousTitle?: string | null;
  nextHref?: string | null;
  nextTitle?: string | null;
  autoplayNext?: boolean;
}) {
  const chatOpen = useChatOpen();
  const collapsed = useSidebarCollapsed();
  const [previewResource, setPreviewResource] = useState<LessonResourceData | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [completed, setCompleted] = useState(initialCompleted);
  const [cinemaMode, setCinemaMode] = useState(getStoredAmbient);
  const [leftWidth, setLeftWidth] = useState(65); // Percentagem da largura esquerda (player)
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { handleTouchStart, handleTouchEnd, swipeClassName, isTransitioning, goPrevious, goNext, showSpinner } =
    useSwipeNav(previousHref, nextHref);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const hintTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const sideBySide = !chatOpen;
  const inlinePreview = sideBySide && previewResource !== null;
  const inlinePreviewHeight = collapsed ? "h-[88vh]" : "h-[70vh]";

  const playerBoxRef = useRef<HTMLDivElement>(null);
  const engagementLikeRef = useRef<(() => void) | null>(null);
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

  // Dica de swipe (mobile, 1ª visita a uma aula) — pointer no fim porque
  // localStorage só existe no cliente.
  useEffect(() => {
    if (!localStorage.getItem(SWIPE_HINT_SEEN_KEY)) setShowSwipeHint(true);
  }, []);

  function dismissSwipeHint() {
    localStorage.setItem(SWIPE_HINT_SEEN_KEY, "1");
    setShowSwipeHint(false);
  }

  function handleHintTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    hintTouchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function handleHintTouchEnd(e: React.TouchEvent) {
    const start = hintTouchStartRef.current;
    hintTouchStartRef.current = null;
    dismissSwipeHint();
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const isSwipe = Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 2;
    if (!isSwipe) return;
    if (dx < 0 && nextHref) goNext();
    else if (dx > 0 && previousHref) goPrevious();
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

  // Resize handler
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - rect.left) / rect.width) * 100;
      
      // Limitar entre 30% e 80%
      if (newLeftWidth >= 30 && newLeftWidth <= 80) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

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

  const engagementWithButton =
    engagement &&
    cloneElement(engagement, {
      completeButton,
      onReady: (handle: LessonEngagementBarHandle) => {
        engagementLikeRef.current = handle.like;
      },
    });

  return (
    <div className={isTransitioning ? "overflow-x-hidden" : ""}>
    {showSpinner && (
      <div className="pointer-events-none fixed inset-0 z-[998] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-white/15 dark:border-t-white/70" />
      </div>
    )}
    {showSwipeHint && (
      <div
        className="fixed inset-0 z-[999] flex animate-[lessonSwipeHintFade_.25s_ease-out] items-center justify-center bg-black/60 backdrop-blur-sm lg:hidden"
        onClick={dismissSwipeHint}
        onTouchStart={handleHintTouchStart}
        onTouchEnd={handleHintTouchEnd}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes lessonSwipeHintFade { from { opacity: 0; } to { opacity: 1; } }
              @keyframes lessonSwipeHintDot { 0%, 100% { transform: translateX(-52px); } 50% { transform: translateX(52px); } }
            `,
          }}
        />
        <div className="mx-10 flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/[0.07] px-7 py-8 text-center shadow-2xl backdrop-blur-xl">
          {/* Track com um ponto a deslizar de um lado ao outro — mostra o
              próprio gesto (arrastar o dedo) em vez de setas estáticas, que
              liam mais a "expandir" do que a "deslizar". */}
          <div className="relative flex h-9 w-36 items-center">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15" />
            <div className="absolute left-0 h-1.5 w-1.5 rounded-full bg-white/25" />
            <div className="absolute right-0 h-1.5 w-1.5 rounded-full bg-white/25" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-5 w-5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]"
                style={{ animation: "lessonSwipeHintDot 1.8s ease-in-out infinite" }}
              />
            </div>
          </div>
          <div>
            <p className="text-base font-semibold text-white">Deslize para navegar</p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/60">
              Arraste para a esquerda ou direita
              <br />
              para mudar de aula
            </p>
          </div>
          <button
            type="button"
            onClick={dismissSwipeHint}
            className="rounded-full bg-white px-6 py-2 text-sm font-medium text-black transition-opacity active:opacity-80"
          >
            Entendi
          </button>
        </div>
      </div>
    )}
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      // -mx-4 px-4 (mobile): estende a zona de swipe até às margens do ecrã,
      // não só à largura do conteúdo — o gesto tem de funcionar em qualquer
      // ponto da tela, incluindo as calhas laterais deixadas pelo padding do
      // layout pai. min-h-[100dvh] (mobile): garante que a zona de toque
      // cobre sempre o ecrã todo mesmo quando o conteúdo da aula é mais
      // baixo que o viewport, senão o espaço vazio por baixo não reagia ao
      // swipe.
      className={`-mx-4 min-h-[100dvh] px-4 lg:mx-0 lg:min-h-0 lg:px-0 ${swipeClassName}`}
    >
      <div className="hidden items-center justify-between lg:flex">
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

      <div className="mt-1 lg:relative lg:mt-4">
        <div ref={containerRef} className={sideBySide ? "lg:relative lg:w-full" : ""}>
          {sideBySide && (
            <style dangerouslySetInnerHTML={{
              __html: `
                @media (min-width: 1024px) {
                  .player-container-resize { width: ${leftWidth}%; padding-right: 0.5rem; position: relative; z-index: 1; }
                  .resize-handle { left: calc(${leftWidth}% + 0.25rem); }
                  .right-panel-resize { left: calc(${leftWidth}% + 1rem); padding-left: 0.5rem; }
                }
              `
            }} />
          )}
          <div
            className={`-mx-4 lg:mx-0 ${sideBySide ? "player-container-resize lg:w-full lg:relative" : "relative"}`}
          >
            {/* Só o player em si (não o título/engagement/comentários abaixo,
                visíveis em desktop) — arrive() usa este rect como alvo do voo
                do clone vindo do card "Continuar onde paraste"; medir o
                bloco inteiro (com o resto do conteúdo por baixo) fazia o
                clone aterrar bem mais alto do que o vídeo real, sobrando por
                baixo do limite dele. */}
            <div ref={playerBoxRef}>
              <LessonPlayer
                key={lessonId}
                lessonId={lessonId}
                type={type}
                contentUrl={contentUrl}
                hlsMasterUrl={hlsMasterUrl}
                captionsUrl={captionsUrl}
                videoRenditions={videoRenditions}
                textContent={textContent}
                initialWatchedSeconds={initialWatchedSeconds}
                onComplete={markComplete}
                cinemaMode={cinemaMode}
                onDoubleTapLike={() => engagementLikeRef.current?.()}
                hasPrevious={Boolean(previousHref)}
                hasNext={Boolean(nextHref)}
                onGoPrevious={previousHref ? goPrevious : undefined}
                onGoNext={nextHref ? goNext : undefined}
                autoplayNext={autoplayNext}
                onToggleCinemaMode={
                  type === "VIDEO"
                    ? () =>
                        setCinemaMode((c) => {
                          setStoredAmbient(!c);
                          return !c;
                        })
                    : undefined
                }
              />
            </div>

            {/* Título e engagement abaixo do player, apenas em desktop */}
            <div className="mt-4 hidden lg:block relative">
              {title}
              {engagementWithButton && <div className="mt-3">{engagementWithButton}</div>}
            </div>
            
            {/* Comentários também no painel esquerdo em desktop */}
            <div className="hidden lg:block relative">{comments}</div>
          </div>

          {/* Resize Handle - apenas em desktop quando sideBySide */}
          {sideBySide && (
            <div
              onMouseDown={handleMouseDown}
              className="resize-handle hidden lg:block lg:absolute lg:top-0 lg:bottom-0 lg:w-3 lg:cursor-col-resize lg:transition-colors"
              style={{ touchAction: 'none' }}
              title="Arrastar para redimensionar"
            >
            </div>
          )}

          <div className="mt-4 lg:hidden">
            {title}
            {engagementWithButton && <div className="mt-3">{engagementWithButton}</div>}
          </div>

          <div className={sideBySide ? "right-panel-resize mt-6 lg:mt-0 lg:absolute lg:top-0 lg:bottom-0 lg:right-0 lg:overflow-y-auto lg:z-10" : "mt-6"}>
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
                notes={notes}
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
