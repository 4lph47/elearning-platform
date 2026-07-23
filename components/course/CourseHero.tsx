"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, X } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { getYouTubeId } from "@/lib/youtube";
import {
  boxFromRect,
  elapsedVideoTime,
  textBoxFromElement,
  toDocumentBox,
  useCardTransition,
} from "@/components/course/CardTransitionContext";
import { useTextFly } from "@/components/course/TextFlyContext";

function ytCommand(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
}

// Têm de bater certo com CardTransitionOverlay.tsx: tempo desde arrived() até
// o wipe do FadeOutScrim terminar de vez (voo + espera parado + revelação).
// Calculado aqui em vez de depender de ler state.revealed (que só outro
// componente define mais tarde) — evita corrida com o finish() dele.
const FLY_MS = 450;
const SETTLE_MS = 1;
const HOLD_MS = 1000;
const REVEAL_MS = 700;
const REMAINING_START_DELAY_MS = FLY_MS + SETTLE_MS + HOLD_MS + REVEAL_MS;
const REMAINING_FADE_MS = 500;

export function CourseHero({
  slug,
  title,
  description,
  category,
  isDraft,
  rating,
  ratingCount,
  enrollmentsCount,
  instructorId,
  instructorName,
  videoUrl,
  thumbnailUrl,
}: {
  slug: string;
  title: string;
  description: string;
  category: string;
  isDraft: boolean;
  rating: number;
  ratingCount: number;
  enrollmentsCount: number;
  instructorId: string;
  instructorName: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const categoryRef = useRef<HTMLSpanElement>(null);
  const instructorRef = useRef<HTMLAnchorElement>(null);
  const ratingBoxRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const youtubeId = videoUrl ? getYouTubeId(videoUrl) : null;
  // Sem API do iframe do YouTube, o tempo de reprodução aproxima-se por
  // quando este vídeo montou (autoplay começa quase de imediato).
  const heroStartedAtRef = useRef(Date.now());
  const { state, arrive, registerSource } = useCardTransition();
  const pending = state?.slug === slug && !state.arrived;
  // Voo só do título (link "voltar" em LessonLayoutShell.tsx) — sistema à
  // parte do vídeo/CardTransitionContext acima, mesma ideia do
  // LessonTitleHeading.tsx: esconde o <h1> real até o clone aterrar.
  const { state: textFlyState, arrive: arriveTitleFly } = useTextFly();
  const titleFlyPending = textFlyState?.id === slug && !textFlyState.arrived;
  const titleHidden = textFlyState?.id === slug && !textFlyState.revealed;
  // Vídeo chega de um card/clone já a meio — continua dali em vez de recomeçar do zero.
  const incomingVideoTime = state?.slug === slug ? elapsedVideoTime(state.videoTime, state.capturedAt) : null;
  // Se ao montar já existe uma transição de card a apontar para esta página,
  // o texto que não voa (breadcrumb, descrição, "alunos matriculados", etc.)
  // começa escondido — só aparece REMAINING_REVEAL_DELAY_MS depois do resto
  // (título/categoria/instrutor/rating) ter aterrado e revelado por completo.
  // Numa visita direta (sem transição), aparece logo, sem atraso nenhum.
  const [remainingVisible, setRemainingVisible] = useState(() => state?.slug !== slug);

  useEffect(() => {
    if (state?.slug !== slug || !state.arrived) return;
    const timer = setTimeout(() => setRemainingVisible(true), REMAINING_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state?.slug, state?.arrived, slug]);

  useEffect(() => {
    if (!pending) return;
    const rect = mediaBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    arrive(slug, {
      video: toDocumentBox(boxFromRect(rect)),
      title: titleRef.current ? toDocumentBox(textBoxFromElement(titleRef.current)) : null,
      category: categoryRef.current ? toDocumentBox(textBoxFromElement(categoryRef.current)) : null,
      instructor: instructorRef.current ? toDocumentBox(textBoxFromElement(instructorRef.current)) : null,
      rating: ratingBoxRef.current ? toDocumentBox(boxFromRect(ratingBoxRef.current.getBoundingClientRect())) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, slug]);

  useEffect(() => {
    heroStartedAtRef.current = Date.now();
  }, [videoUrl]);

  useEffect(() => {
    if (!titleFlyPending || !titleRef.current) return;
    arriveTitleFly(slug, textBoxFromElement(titleRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleFlyPending, slug]);

  // Torna esta página fonte de transição pra quem navega DAQUI pra uma aula
  // (botão "Continuar curso", lista de aulas) — o vídeo do hero voa até ao
  // player da aula em vez de simplesmente trocar de página.
  useEffect(() => {
    return registerSource(slug, {
      getBox: () => {
        const rect = mediaBoxRef.current?.getBoundingClientRect();
        return rect ? toDocumentBox(boxFromRect(rect)) : { top: 0, left: 0, width: 0, height: 0 };
      },
      getVideoTime: () => {
        if (youtubeId) return (Date.now() - heroStartedAtRef.current) / 1000;
        return videoRef.current && !videoRef.current.paused ? videoRef.current.currentTime : 0;
      },
      videoUrl,
      youtubeId,
      thumbnailUrl,
    });
  }, [registerSource, slug, videoUrl, youtubeId, thumbnailUrl]);

  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!videoUrl || maximized) return;
    hideTimer.current = setTimeout(() => {
      if (youtubeId || !videoRef.current?.paused) setVisible(false);
    }, 5000);
  }

  useEffect(() => {
    if (videoUrl) scheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  function handleMouseEnter() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
  }

  function handleMouseMove() {
    setVisible(true);
  }

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  }

  function toggleMaximize() {
    if (!videoUrl) return;
    const next = !maximized;
    setMaximized(next);
    setVisible(true);
    if (youtubeId) {
      ytCommand(iframeRef.current, next ? "unMute" : "mute");
    } else if (videoRef.current) {
      videoRef.current.muted = !next;
    }
  }

  const remainingStyle: React.CSSProperties = {
    opacity: remainingVisible ? 1 : 0,
    transition: `opacity ${REMAINING_FADE_MS}ms ease-out`,
  };

  return (
    <div
      className="relative -mt-16 overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => videoUrl && !paused && !maximized && setVisible(false)}
    >
      <div
        ref={mediaBoxRef}
        className={
          videoUrl
            ? maximized
              ? "fixed inset-0 z-50 cursor-pointer bg-black"
              : "absolute inset-0 cursor-pointer"
            : "absolute inset-0"
        }
        onClick={toggleMaximize}
      >
        {youtubeId ? (
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`}
            title={title}
            allow="autoplay; encrypted-media"
            onLoad={() => {
              if (incomingVideoTime !== null) ytCommand(iframeRef.current, "seekTo", [incomingVideoTime, true]);
            }}
            className={
              maximized
                ? "pointer-events-none absolute inset-0 h-full w-full"
                : "pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2"
            }
          />
        ) : videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            onPlay={() => setPaused(false)}
            onPause={() => {
              setPaused(true);
              setVisible(true);
            }}
            onLoadedMetadata={(e) => {
              if (incomingVideoTime !== null) e.currentTarget.currentTime = incomingVideoTime;
            }}
            className="h-full w-full object-cover"
          />
        ) : thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-slate-200 dark:bg-slate-900" />
        )}
        {!maximized && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/70 to-white/30 dark:from-black dark:via-black/70 dark:to-black/30" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/85 via-white/20 to-transparent dark:from-black/85 dark:via-black/20 dark:to-transparent" />
          </>
        )}
      </div>

      {videoUrl && (
        <div
          className={`z-10 flex items-center gap-2 transition-opacity duration-300 ${
            maximized ? "fixed right-4 top-20" : "absolute bottom-4 right-4"
          } ${visible ? "opacity-100" : "opacity-0"}`}
        >
          {!youtubeId && !maximized && (
            <button
              onClick={togglePlay}
              aria-label={paused ? "Reproduzir trailer" : "Pausar trailer"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              {paused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMaximize();
            }}
            aria-label={maximized ? "Minimizar trailer" : "Maximizar trailer"}
            className={
              maximized
                ? "flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                : "flex h-9 items-center justify-center rounded-full bg-black/60 px-3 text-[10px] font-semibold uppercase tracking-wide text-white hover:bg-black/80"
            }
          >
            {maximized ? <X size={16} /> : "Ecrã inteiro"}
          </button>
        </div>
      )}

      {/* Sem min-h fixo no mobile: com altura fixa, texto mais curto/comprido do
      que os 520px previstos sobrava/faltava espaço, criando um corte visível
      entre a zona escura do vídeo e o branco da página a seguir. */}
      {!maximized && (
        <div className="pointer-events-none relative flex items-center px-3 py-14 pt-24 sm:min-h-[600px] sm:px-6 sm:py-20 sm:pt-28">
          <div
            className={`pointer-events-auto mt-20 max-w-xl text-left transition-all duration-300 sm:mt-16 ${
              visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          >
            <nav
              className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
              style={remainingStyle}
            >
              <Link href="/courses" className="hover:text-slate-900 hover:underline dark:hover:text-white">
                Cursos
              </Link>
              <span>/</span>
              <Link
                href={`/courses?category=${encodeURIComponent(category)}`}
                className="hover:text-slate-900 hover:underline dark:hover:text-white"
              >
                {category}
              </Link>
            </nav>
            <div className="mb-3 flex items-center gap-2">
              <span
                ref={categoryRef}
                className="inline-block rounded bg-blue-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white"
              >
                {category}
              </span>
              {isDraft && (
                <span
                  className="inline-block rounded border border-slate-900/25 px-2 py-0.5 text-xs font-medium text-slate-600 dark:border-white/25 dark:text-slate-300"
                  style={remainingStyle}
                >
                  Rascunho
                </span>
              )}
            </div>
            <h1
              ref={titleRef}
              style={{ visibility: titleHidden ? "hidden" : "visible" }}
              className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl"
            >
              {title}
            </h1>
            <p className="mt-3 text-slate-700 dark:text-slate-300" style={remainingStyle}>
              {description}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {ratingCount > 0 && (
                <div ref={ratingBoxRef}>
                  <StarRating rating={rating} count={ratingCount} />
                </div>
              )}
              <span className="text-slate-500 dark:text-slate-400" style={remainingStyle}>
                {enrollmentsCount} aluno{enrollmentsCount !== 1 ? "s" : ""} matriculado{enrollmentsCount !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              <span style={remainingStyle}>Criado por </span>
              <Link
                ref={instructorRef}
                href={`/instructors/${instructorId}`}
                className="font-medium text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
              >
                {instructorName}
              </Link>
            </p>
          </div>
        </div>
      )}
      {maximized && <div className="sm:min-h-[600px]" aria-hidden />}
    </div>
  );
}
