"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { getYouTubeId } from "@/lib/youtube";
import { useAmbientColor } from "@/lib/useAmbientColor";
import type { CourseCardData } from "@/components/course/CourseCard";
import {
  boxFromRect,
  findScrollAncestor,
  ROW_ZOOM_SCALE,
  textBoxFromElement,
  useCardTransition,
  type TransitionKind,
} from "@/components/course/CardTransitionContext";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermédio",
  advanced: "Avançado",
};

export function CourseTile({
  course,
  className = "",
  href,
  progressPercent,
  hidePrice,
  destinationKind = "hero",
  cardId,
  rowZoom,
  rank,
}: {
  course: CourseCardData;
  className?: string;
  href?: string;
  progressPercent?: number;
  hidePrice?: boolean;
  destinationKind?: TransitionKind;
  cardId?: string;
  rowZoom?: boolean;
  // Posição no ranking ativo (ex.: ordenar por "mais favoritos") — mostra
  // "#1", "#2"... no canto do card. Só aparece quando esse tipo de ordenação
  // está ativa (ver app/courses/page.tsx).
  rank?: number;
}) {
  const [showTrailer, setShowTrailer] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sem API do iframe do YouTube, o tempo de reprodução aproxima-se por quando
  // o trailer arrancou (autoplay começa quase de imediato ao montar o iframe).
  const trailerStartedAtRef = useRef<number | null>(null);
  const youtubeId = course.trailerUrl ? getYouTubeId(course.trailerUrl) : null;
  const linkRef = useRef<HTMLAnchorElement>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const iframeElRef = useRef<HTMLIFrameElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const categoryRef = useRef<HTMLSpanElement>(null);
  const instructorRef = useRef<HTMLParagraphElement>(null);
  const ratingBoxRef = useRef<HTMLDivElement>(null);
  const { state, start } = useCardTransition();
  const autoId = useId();
  // Igual ao modo ambiente do vídeo nas aulas (LessonPlayer) — glow atrás do
  // card com a cor média do frame atual, só enquanto o trailer nativo (não
  // YouTube, sem CORS) está a reproduzir (hover no desktop, clique/zoom no
  // mobile — ambos ligam showTrailer).
  const ambientColor = useAmbientColor(videoElRef, showTrailer && !youtubeId);
  // A row (CourseRow) é "overflow-x-auto" — por regra do CSS, overflow-y
  // "visible" nesse caso passa sozinho a computar como "auto" (não fica
  // mesmo visível), por isso corta o blur do glow antes de esmorecer de
  // todo, sobretudo em cima. Medir a posição real do card e desenhar o glow
  // num portal fixed (fora da row) escapa a esse corte por completo — mesma
  // técnica do clone em CardTransitionOverlay.tsx.
  const [glowRect, setGlowRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!showTrailer || youtubeId) {
      setGlowRect(null);
      return;
    }
    // rAF, não só scroll/resize: o card cresce por transição CSS (scale-1.15,
    // 300ms) — a caixa muda a cada frame enquanto anima, só ligar a
    // scroll/resize deixava o glow parado no tamanho de antes de crescer.
    let frame: number;
    function measure() {
      if (videoBoxRef.current) setGlowRect(videoBoxRef.current.getBoundingClientRect());
      frame = requestAnimationFrame(measure);
    }
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [showTrailer, youtubeId]);
  // O mesmo curso pode aparecer em várias rows (Populares, Recentes, categoria...)
  // — comparar por slug faria TODAS essas instâncias expandirem juntas. cardId
  // identifica só este card específico (prop, se vier de uma row, senão gerado aqui).
  const id = cardId ?? autoId;
  // Só sobe acima do FadeOutScrim (z-900) enquanto se espera a página seguinte.
  // Assim que chega (arrived), larga a elevação — o clone assume o sítio e o
  // scrim tapa tudo, incluindo aqui, para não sobrar o card real por baixo dele.
  const isTransitioning = state?.cardId === id && !state.arrived;

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  function handleEnter() {
    if (!course.trailerUrl) return;
    hoverTimer.current = setTimeout(() => {
      trailerStartedAtRef.current = Date.now();
      setShowTrailer(true);
    }, 500);
  }

  function handleLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    trailerStartedAtRef.current = null;
    setShowTrailer(false);
  }

  function handleClick() {
    if (!videoBoxRef.current) return;
    // O vídeo só arrancava 500ms depois do hover (handleEnter) — se clicasses
    // antes disso, ainda não estava a tocar. Força já, sem esperar pelo timer.
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const videoTime = videoElRef.current && !videoElRef.current.paused ? videoElRef.current.currentTime : 0;
    const youtubeTime = trailerStartedAtRef.current ? (Date.now() - trailerStartedAtRef.current) / 1000 : 0;
    if (!showTrailer) trailerStartedAtRef.current = Date.now();
    setShowTrailer(true);

    // Texto clona-se sempre (zoom mantém-no visível independentemente do
    // destino) — só o VOO até um alvo real depende de ser "hero" (ver
    // CardTransitionOverlay.tsx: sem alvo, esmorece em vez de voar).
    // Tamanho normal (1x), antes de qualquer zoom — clone nasce aqui e cresce
    // gradualmente até ao tamanho escalado (CardTransitionOverlay.tsx).
    const videoRawBox = boxFromRect(videoBoxRef.current.getBoundingClientRect());
    const titleRawBox = titleRef.current ? textBoxFromElement(titleRef.current) : null;
    const categoryRawBox = categoryRef.current ? textBoxFromElement(categoryRef.current) : null;
    const instructorRawBox = instructorRef.current ? textBoxFromElement(instructorRef.current) : null;
    const ratingRawBox = ratingBoxRef.current ? boxFromRect(ratingBoxRef.current.getBoundingClientRect()) : null;

    // Card numa row com zoom-hover (CourseRow) só atinge o scale-1.15 300ms
    // depois do clique, por transição CSS — medir agora dava sempre a caixa
    // do tamanho normal. Em vez de recalcular a posição escalada à mão
    // (transform-origin é fácil de errar), força o scale já, sem transição,
    // deixa o PRÓPRIO BROWSER assentar o layout, mede tudo nesse tamanho
    // final, e desfaz — a classe scale-[1.15] da row assume a partir daqui
    // (com a animação normal de 300ms) assim que o clique atualizar o
    // context. Wrapper (transformOrigin/scale, CourseRow.tsx) é o AVÔ do
    // <Link>, não o pai — o LazyMount mete um <div> extra no meio. Pai
    // direto (LazyMount) não tem transformOrigin nenhum, escalava sempre a
    // partir do centro — cards do meio calha por acaso (origem já é center),
    // mas nos das pontas (left/right) a caixa media sai errada, sem o
    // crescimento unidirecional certo.
    const wrapperEl = rowZoom ? linkRef.current?.parentElement?.parentElement : null;
    let unsnap: (() => void) | null = null;
    if (wrapperEl instanceof HTMLElement) {
      const prevTransition = wrapperEl.style.transition;
      const prevTransform = wrapperEl.style.transform;
      wrapperEl.style.transition = "none";
      wrapperEl.style.transform = `scale(${ROW_ZOOM_SCALE})`;
      void wrapperEl.offsetHeight; // força reflow antes de medir
      unsnap = () => {
        wrapperEl.style.transform = prevTransform;
        wrapperEl.style.transition = prevTransition;
      };
    }

    const videoBox = boxFromRect(videoBoxRef.current.getBoundingClientRect());
    const titleBox = titleRef.current ? textBoxFromElement(titleRef.current) : null;
    const categoryBox = categoryRef.current ? textBoxFromElement(categoryRef.current) : null;
    const instructorBox = instructorRef.current ? textBoxFromElement(instructorRef.current) : null;
    const ratingBox = ratingBoxRef.current ? boxFromRect(ratingBoxRef.current.getBoundingClientRect()) : null;

    unsnap?.();

    const scrollOriginEl = findScrollAncestor(videoBoxRef.current);

    start({
      cardId: id,
      slug: course.slug,
      destinationKind,
      videoRawBox,
      titleRawBox,
      categoryRawBox,
      instructorRawBox,
      ratingRawBox,
      videoBox,
      titleBox,
      categoryBox,
      instructorBox,
      ratingBox,
      title: course.title,
      category: course.category,
      instructorName: course.instructorName,
      lessonCount: course.lessonCount,
      rating: course.rating,
      ratingCount: course.ratingCount,
      thumbnailUrl: course.thumbnailUrl,
      videoUrl: course.trailerUrl,
      youtubeId,
      videoTime: youtubeId ? youtubeTime : videoTime,
      capturedAt: Date.now(),
      scrollOriginEl,
      scrollOriginLeft: scrollOriginEl?.scrollLeft ?? 0,
      scrollOriginTop: scrollOriginEl?.scrollTop ?? 0,
    });
  }

  return (
    <>
    <Link
      ref={linkRef}
      href={href ?? `/courses/${course.slug}`}
      prefetch
      // Clone (CardTransitionOverlay) assume o lugar assim que a transição
      // arranca — o card real esconde-se já (opacity-0), nunca os dois ao
      // mesmo tempo. pointer-events-none evita cliques duplos enquanto
      // invisível.
      className={`group relative block ${isTransitioning ? "pointer-events-none opacity-0" : ""} ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleClick}
    >
      <div
        ref={videoBoxRef}
        className="relative aspect-video overflow-hidden rounded-lg bg-slate-800 ring-1 ring-white/10 transition-all duration-200 group-hover:ring-slate-400 group-hover:shadow-lg group-hover:shadow-black/40 dark:group-hover:ring-white/40"
      >
        {showTrailer && youtubeId ? (
          <iframe
            ref={iframeElRef}
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&playlist=${youtubeId}&controls=0&modestbranding=1&rel=0&playsinline=1`}
            title={course.title}
            allow="autoplay; encrypted-media"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        ) : showTrailer && course.trailerUrl ? (
          <video
            ref={videoElRef}
            src={course.trailerUrl}
            autoPlay
            muted
            loop
            playsInline
            crossOrigin="anonymous"
            className="h-full w-full object-cover"
          />
        ) : course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={course.title}
            fill
            sizes="(max-width: 640px) 90vw, 320px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-slate-500">
            {course.title.charAt(0).toUpperCase()}
          </div>
        )}

        {!showTrailer && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-black">
              <Play size={15} fill="currentColor" />
            </span>
          </div>
        )}

        {!hidePrice && (
          <span className="absolute right-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {course.price === 0 ? "Grátis" : `${course.price.toFixed(2)}€`}
          </span>
        )}

        {typeof rank === "number" && (
          <span className="absolute left-2 top-2 rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
            #{rank}
          </span>
        )}

        {typeof progressPercent === "number" && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
            <div className="h-full bg-blue-500" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>

      <div className="mt-2.5">
        <div className="flex items-center gap-1.5 text-xs">
          <span ref={categoryRef} className="font-medium text-blue-600 dark:text-blue-400">
            {course.category}
          </span>
          <span className="text-slate-400 dark:text-slate-600">·</span>
          <span className="text-slate-500 dark:text-slate-400">{LEVEL_LABEL[course.level] ?? course.level}</span>
        </div>
        <h3
          ref={titleRef}
          className="mt-0.5 line-clamp-1 font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400"
        >
          {course.title}
        </h3>
        <p ref={instructorRef} className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {course.instructorName} · {course.lessonCount} aulas
        </p>
        {course.ratingCount > 0 && (
          <div ref={ratingBoxRef} className="mt-1">
            <StarRating rating={course.rating} count={course.ratingCount} />
          </div>
        )}
      </div>
    </Link>
    {glowRect &&
      !youtubeId &&
      // Enquanto a transição de clique está ativa, quem mostra o glow é o
      // clone (CardTransitionOverlay, com fade-in atrasado) — este aparecia
      // logo no clique, por cima/ao mesmo tempo, dando dois glows a um só
      // tempo.
      !isTransitioning &&
      createPortal(
        // box-shadow (não um div preenchido maior por baixo) — a sombra só
        // pinta FORA da própria caixa, nunca por cima do conteúdo dela. Caixa
        // aqui bate exata com o vídeo (sem inset, sem fundo próprio), por
        // isso pode ir à frente de tudo (z-index alto) sem nunca tapar o
        // vídeo — resolve o braço-de-ferro de stacking-context entre a row
        // (transform cria o seu próprio) e este portal (fixed, à parte).
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-lg transition-shadow duration-500"
          style={{
            top: glowRect.top,
            left: glowRect.left,
            width: glowRect.width,
            height: glowRect.height,
            boxShadow: `0 0 36px 10px ${ambientColor}`,
            opacity: 0.75,
            zIndex: 15,
          }}
        />,
        document.body
      )}
    </>
  );
}
