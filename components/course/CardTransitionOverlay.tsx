"use client";

import { useEffect, useRef, useState } from "react";
import { StarRating } from "@/components/ui/StarRating";
import {
  elapsedVideoTime,
  useCardTransition,
  type TransitionBox,
  type TransitionTextBox,
} from "@/components/course/CardTransitionContext";
import { useAmbientColor } from "@/lib/useAmbientColor";

function seekYoutube(iframe: HTMLIFrameElement | null, seconds: number) {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [seconds, true] }), "*");
}

const FLY_MS = 450;
const GLOW_FADE_IN_MS = 1000;
const SETTLE_MS = 1;
const HOLD_MS = 1000;
const REVEAL_MS = 700;
// Generoso de propósito: primeira navegação para uma rota ainda não compilada
// (dev, on-demand) pode facilmente passar dos 6s antigos — isso disparava o
// fallback a meio da espera, desfazendo o zoom (volta ao tamanho normal) antes
// da página seguinte sequer chegar a chamar arrive(). Só existe para o caso
// realmente quebrado (redirect/erro), não para navegação normal só lenta.
const FALLBACK_MS = 20000;
// Bate com duration-300 do zoom-hover da row (CourseRow.tsx) — mesmo tempo
// que o card real levaria a crescer, se não estivesse escondido.
const ZOOM_MS = 300;

function boxStyle(box: TransitionBox): React.CSSProperties {
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

function textBoxStyle(box: TransitionTextBox): React.CSSProperties {
  return {
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
    fontSize: box.fontSize,
    lineHeight: `${box.lineHeight}px`,
    color: box.color,
  };
}

function glowBoxStyle(box: TransitionBox, inset: number): React.CSSProperties {
  return {
    top: box.top - inset,
    left: box.left - inset,
    width: box.width + inset * 2,
    height: box.height + inset * 2,
  };
}

export function CardTransitionOverlay() {
  const { state, reveal, finish } = useCardTransition();
  const [zoomed, setZoomed] = useState(false);
  const [animate, setAnimate] = useState(false);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const iframeElRef = useRef<HTMLIFrameElement>(null);
  // Clone é quem fica visível durante o zoom/voo (o CourseTile real esconde-se
  // já em opacity-0) — o glow ambiente (CourseTile.tsx) tem de viver aqui
  // também, senão nunca se vê enquanto o trailer nativo reproduz a zoomar.
  const ambientColor = useAmbientColor(videoElRef, Boolean(state?.videoUrl) && !state?.youtubeId);

  // Scroll da row de origem (CourseRow.tsx, overflow-x-auto) não move o clone
  // sozinho (overlay é fixed, fora da row) — segue o delta ao vivo enquanto a
  // origem existir, pra o clone ser "arrastado" com
  // os outros cards da row (não selecionados) em vez de ficar preso no sítio
  // do clique. Aplicado por REF (transform, direto no DOM) em vez de estado
  // React — passar pelo top/left normais (que têm `transition: all`) fazia o
  // clone "correr atrás" do scroll com um esmorecer de ${transitionMs}ms em
  // vez de acompanhar instantaneamente como os outros cards.
  const glowRef = useRef<HTMLDivElement>(null);
  const videoWrapRef = useRef<HTMLDivElement>(null);
  const titleElRef = useRef<HTMLDivElement>(null);
  const categoryElRef = useRef<HTMLDivElement>(null);
  const instructorElRef = useRef<HTMLDivElement>(null);
  const ratingElRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shiftables = [glowRef, videoWrapRef, titleElRef, categoryElRef, instructorElRef, ratingElRef];
    function applyShift(dx: number, dy: number) {
      const t = dx || dy ? `translate(${-dx}px, ${-dy}px)` : "";
      for (const ref of shiftables) if (ref.current) ref.current.style.transform = t;
    }
    const el = state?.scrollOriginEl;
    if (!el || state.arrived) {
      applyShift(0, 0);
      return;
    }
    const originLeft = state.scrollOriginLeft;
    const originTop = state.scrollOriginTop;
    function onScroll() {
      applyShift(el!.scrollLeft - originLeft, el!.scrollTop - originTop);
    }
    // Sincroniza já no instante em que o efeito liga (não só no PRÓXIMO
    // evento) — entre o clique (síncrono) e o efeito montar (só no tick
    // seguinte) o utilizador pode já ter scrollado a row; sem isto esse
    // scroll ficava permanentemente por contar (eventos "scroll" só disparam
    // em mudanças futuras, nunca retroativamente).
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.cardId, state?.arrived]);

  // Se a página seguinte nunca chamar arrive() (ex.: redirect/erro), nada ficou
  // escondido nem visível fora do sítio — só limpa o estado pendente ao fim de um tempo.
  useEffect(() => {
    if (!state || state.arrived) return;
    const giveUp = setTimeout(() => finish(), FALLBACK_MS);
    return () => clearTimeout(giveUp);
  }, [state, finish]);

  // Clone nasce no tamanho normal (videoRawBox) e cresce gradualmente até ao
  // tamanho com zoom (videoBox) — sem isto saltava logo pro tamanho final,
  // sem o crescimento que o card real teria mostrado (agora escondido).
  useEffect(() => {
    setZoomed(false);
    if (!state) return;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setZoomed(true));
    });
    return () => cancelAnimationFrame(raf1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.cardId]);

  // O maximize (voo do clone) só arranca quando a página seguinte reporta a
  // posição real via arrive() — o fade do resto da página já começou antes (start()).
  useEffect(() => {
    setAnimate(false);
    if (!state?.arrived) return;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimate(true));
    });
    const revealTimer = setTimeout(() => reveal(), FLY_MS + SETTLE_MS + HOLD_MS);
    const finishTimer = setTimeout(() => finish(), FLY_MS + SETTLE_MS + HOLD_MS + REVEAL_MS);
    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(revealTimer);
      clearTimeout(finishTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.arrived]);

  // Mostra já o clone na posição de origem assim que start() dispara — nunca
  // esperar por arrive(): a navegação desmonta a página antiga e, sem isto, o
  // card clicado desaparecia durante a janela em que a página seguinte ainda
  // está em branco. Só anima (voo) quando arrived chega com o alvo real.
  if (!state) return null;

  // Duração muda por fase: sem transição enquanto nasce (0), 300ms a crescer
  // pro zoom (bate com a row), 450ms a voar pro alvo real (hero/aula).
  const transitionMs = !zoomed ? 0 : animate ? FLY_MS : ZOOM_MS;
  // "hero" tem alvo real pro texto voar (CourseHero chama arrive() com as
  // posições). "lesson-video"/"lesson-text" não têm onde o texto aterrar —
  // fica no sítio (zoomado) e esmorece assim que o vídeo começa a voar.
  const fliesToTarget = state.destinationKind === "hero";
  const textOpacity = animate && !fliesToTarget ? 0 : 1;
  const videoBox = !zoomed ? state.videoRawBox : animate ? state.videoTargetBox : state.videoBox;
  const titleBox = !zoomed
    ? state.titleRawBox
    : state.titleBox
      ? animate
        ? state.titleTargetBox ?? state.titleBox
        : state.titleBox
      : null;
  const categoryBox = !zoomed
    ? state.categoryRawBox
    : state.categoryBox
      ? animate
        ? state.categoryTargetBox ?? state.categoryBox
        : state.categoryBox
      : null;
  const instructorBox = !zoomed
    ? state.instructorRawBox
    : state.instructorBox
      ? animate
        ? state.instructorTargetBox ?? state.instructorBox
        : state.instructorBox
      : null;
  const ratingBox = !zoomed
    ? state.ratingRawBox
    : state.ratingBox
      ? animate
        ? state.ratingTargetBox ?? state.ratingBox
        : state.ratingBox
      : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[999]">
      {state.videoUrl && !state.youtubeId && (
        <div
          ref={glowRef}
          aria-hidden
          className="pointer-events-none absolute rounded-2xl blur-xl"
          style={{
            ...glowBoxStyle(videoBox, zoomed ? 14 : 6),
            backgroundColor: ambientColor,
            // Nasce a 0 (não já a 0.75) — sem isto o glow aparecia de repente
            // no primeiro frame, antes de zoomed sequer ligar (ver useEffect
            // do zoom, 2 RAFs). Só faz sentido junto ao card parado (zoom) —
            // assim que o vídeo começa mesmo a voar (animate) para o alvo,
            // esmorece suave, nunca corta abruptamente nem viaja com o vídeo.
            opacity: !zoomed ? 0 : animate ? 0 : 0.75,
            // Só começa a aparecer DEPOIS do zoom da caixa (ZOOM_MS) ter
            // terminado — delay na transição, não em paralelo. Daí demora
            // GLOW_FADE_IN_MS (pedido: pelo menos 1s a aparecer), duração bem
            // mais lenta que o zoom, por isso separada da transição "all". No
            // voo (animate), esmorece já, sem delay, no ritmo mais rápido de sempre (FLY_MS).
            transition: `all ${transitionMs}ms ease-out, background-color 500ms ease-out, transform 0s linear, opacity ${
              zoomed && !animate ? `${GLOW_FADE_IN_MS}ms ease-out ${ZOOM_MS}ms` : `${FLY_MS}ms ease-out`
            }`,
          }}
        />
      )}
      <div
        ref={videoWrapRef}
        className="absolute overflow-hidden rounded-lg bg-black"
        style={{ ...boxStyle(videoBox), transition: `all ${transitionMs}ms ease-out, transform 0s linear` }}
      >
        {state.youtubeId ? (
          <iframe
            ref={iframeElRef}
            src={`https://www.youtube.com/embed/${state.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${state.youtubeId}&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1`}
            title={state.title}
            allow="autoplay; encrypted-media"
            className="h-full w-full"
            onLoad={() => seekYoutube(iframeElRef.current, elapsedVideoTime(state.videoTime, state.capturedAt))}
          />
        ) : state.videoUrl ? (
          <video
            ref={videoElRef}
            src={state.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            crossOrigin="anonymous"
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = elapsedVideoTime(state.videoTime, state.capturedAt);
            }}
            className="h-full w-full object-cover"
          />
        ) : state.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : null}

        {state.titleBox && animate && fliesToTarget && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/70 to-white/30 dark:from-black dark:via-black/70 dark:to-black/30 transition-opacity duration-300" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/85 via-white/20 to-transparent dark:from-black/85 dark:via-black/20 dark:to-transparent transition-opacity duration-300" />
          </>
        )}
      </div>

      {titleBox && (
        <div
          // Antes do voo (!animate) ainda no card de origem — peso tem de
          // bater com o <h3> real (font-semibold). Depois do voo (animate),
          // já é o alvo (CourseHero h1 font-bold). line-height vem sempre do
          // elemento medido (textBoxStyle), nunca adivinhado por classe.
          ref={titleElRef}
          className={`absolute overflow-hidden whitespace-nowrap ${animate ? "font-bold" : "font-semibold"}`}
          style={{ ...textBoxStyle(titleBox), opacity: textOpacity, transition: `all ${transitionMs}ms ease-out, transform 0s linear` }}
        >
          {state.title}
        </div>
      )}

      {categoryBox && (
        <div
          ref={categoryElRef}
          className={`absolute overflow-hidden whitespace-nowrap ${animate ? "font-semibold uppercase tracking-wide" : "font-medium"}`}
          style={{ ...textBoxStyle(categoryBox), opacity: textOpacity, transition: `all ${transitionMs}ms ease-out, transform 0s linear` }}
        >
          {state.category}
        </div>
      )}

      {instructorBox && (
        <div
          ref={instructorElRef}
          className={`absolute overflow-hidden whitespace-nowrap ${animate ? "font-medium" : ""}`}
          style={{ ...textBoxStyle(instructorBox), opacity: textOpacity, transition: `all ${transitionMs}ms ease-out, transform 0s linear` }}
        >
          {/* Origem (card) mostra "nome · X aulas", igual ao <p> real medido.
              Alvo (hero) só tem o nome — "X aulas" não existe lá. */}
          {state.instructorName}
          {!animate && ` · ${state.lessonCount} aulas`}
        </div>
      )}

      {ratingBox && (
        <div
          ref={ratingElRef}
          className="absolute overflow-hidden"
          style={{ ...boxStyle(ratingBox), opacity: textOpacity, transition: `all ${transitionMs}ms ease-out, transform 0s linear` }}
        >
          <StarRating rating={state.rating} count={state.ratingCount} />
        </div>
      )}
    </div>
  );
}
