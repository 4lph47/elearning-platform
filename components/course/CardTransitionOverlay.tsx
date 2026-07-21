"use client";

import { useEffect, useState } from "react";
import { StarRating } from "@/components/ui/StarRating";
import { useCardTransition, type TransitionBox, type TransitionTextBox } from "@/components/course/CardTransitionContext";

const FLY_MS = 450;
const SETTLE_MS = 1;
const HOLD_MS = 1000;
const REVEAL_MS = 700;
const FALLBACK_MS = 6000;

function boxStyle(box: TransitionBox): React.CSSProperties {
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

function textBoxStyle(box: TransitionTextBox): React.CSSProperties {
  return { top: box.top, left: box.left, width: box.width, height: box.height, fontSize: box.fontSize, color: box.color };
}

export function CardTransitionOverlay() {
  const { state, reveal, finish } = useCardTransition();
  const [animate, setAnimate] = useState(false);

  // Se a página seguinte nunca chamar arrive() (ex.: redirect/erro), nada ficou
  // escondido nem visível fora do sítio — só limpa o estado pendente ao fim de um tempo.
  useEffect(() => {
    if (!state || state.arrived) return;
    const giveUp = setTimeout(() => finish(), FALLBACK_MS);
    return () => clearTimeout(giveUp);
  }, [state, finish]);

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

  if (!state?.arrived) return null;

  const videoBox = animate ? state.videoTargetBox : state.videoBox;
  const titleBox = state.titleBox ? (animate ? state.titleTargetBox ?? state.titleBox : state.titleBox) : null;
  const categoryBox = state.categoryBox
    ? animate
      ? state.categoryTargetBox ?? state.categoryBox
      : state.categoryBox
    : null;
  const instructorBox = state.instructorBox
    ? animate
      ? state.instructorTargetBox ?? state.instructorBox
      : state.instructorBox
    : null;
  const ratingBox = state.ratingBox ? (animate ? state.ratingTargetBox ?? state.ratingBox : state.ratingBox) : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[999]">
      <div
        className="absolute overflow-hidden rounded-lg bg-black"
        style={{ ...boxStyle(videoBox), transition: `all ${FLY_MS}ms ease-out` }}
      >
        {state.youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${state.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${state.youtubeId}&controls=0&modestbranding=1&rel=0&playsinline=1`}
            title={state.title}
            allow="autoplay; encrypted-media"
            className="h-full w-full"
          />
        ) : state.videoUrl ? (
          <video src={state.videoUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
        ) : state.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : null}

        {state.titleBox && animate && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/70 to-white/30 dark:from-black dark:via-black/70 dark:to-black/30 transition-opacity duration-300" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/85 via-white/20 to-transparent dark:from-black/85 dark:via-black/20 dark:to-transparent transition-opacity duration-300" />
          </>
        )}
      </div>

      {titleBox && (
        <div
          className="absolute overflow-hidden font-bold leading-tight"
          style={{ ...textBoxStyle(titleBox), transition: `all ${FLY_MS}ms ease-out` }}
        >
          {state.title}
        </div>
      )}

      {categoryBox && (
        <div
          className="absolute overflow-hidden font-semibold"
          style={{ ...textBoxStyle(categoryBox), transition: `all ${FLY_MS}ms ease-out` }}
        >
          {state.category}
        </div>
      )}

      {instructorBox && (
        <div
          className="absolute overflow-hidden"
          style={{ ...textBoxStyle(instructorBox), transition: `all ${FLY_MS}ms ease-out` }}
        >
          {state.instructorName}
        </div>
      )}

      {ratingBox && (
        <div
          className="absolute overflow-hidden"
          style={{ ...boxStyle(ratingBox), transition: `all ${FLY_MS}ms ease-out` }}
        >
          <StarRating rating={state.rating} count={state.ratingCount} />
        </div>
      )}
    </div>
  );
}
