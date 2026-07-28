"use client";

import { forwardRef, useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import Image from "next/image";
import { getYouTubeId } from "@/lib/youtube";

export interface MediaCarouselItem {
  thumbnailUrl: string | null;
  videoUrl: string | null;
}

// Camada visual partilhada do hero da página principal (HeroCarousel) — só o
// fundo (thumbnail/trailer com crossfade + gradientes) é genérico aqui;
// texto/CTA continuam em cada chamador (mudam por completo entre o carrossel
// de cursos e o de bundle). O índice ativo é controlado de fora (quem chama
// já precisa dele para o próprio texto) — só o atraso do crossfade do
// media (400ms) é interno, tal como sempre foi.
export const MediaCarouselBackground = forwardRef<
  HTMLElement,
  {
    items: MediaCarouselItem[];
    activeIndex: number;
    onHoverChange?: (hovering: boolean) => void;
    onSwipe?: (direction: "left" | "right") => void;
    minHeightClassName?: string;
    children: ReactNode;
  }
>(function MediaCarouselBackground(
  {
    items,
    activeIndex,
    onHoverChange,
    onSwipe,
    minHeightClassName = "min-h-[520px] sm:min-h-[460px] lg:min-h-[600px]",
    children,
  },
  ref
) {
  const [mediaIndex, setMediaIndex] = useState(activeIndex);
  const [mediaVisible, setMediaVisible] = useState(true);
  const mediaMounted = useRef(false);
  const touchStartX = useRef<number | null>(null);

  function handleTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const SWIPE_THRESHOLD = 40;
    if (deltaX <= -SWIPE_THRESHOLD) onSwipe?.("left");
    else if (deltaX >= SWIPE_THRESHOLD) onSwipe?.("right");
  }

  useEffect(() => {
    if (!mediaMounted.current) {
      mediaMounted.current = true;
      return;
    }
    setMediaVisible(false);
    const timer = setTimeout(() => {
      setMediaIndex(activeIndex);
      setMediaVisible(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  const activeItem = items[activeIndex] ?? items[0];
  const activeVideoUrl = items[mediaIndex]?.videoUrl ?? null;
  const activeYoutubeId = activeVideoUrl ? getYouTubeId(activeVideoUrl) : null;

  return (
    <section
      ref={ref}
      className={`relative overflow-hidden ${minHeightClassName}`}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0">
        {items.map((item, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === activeIndex ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {item.thumbnailUrl ? (
              <Image src={item.thumbnailUrl} alt="" fill sizes="100vw" priority={i === 0} className="object-cover" />
            ) : (
              <div className="h-full w-full bg-slate-200 dark:bg-slate-900" />
            )}
          </div>
        ))}

        <div className={`absolute inset-0 transition-opacity duration-500 ${mediaVisible ? "opacity-100" : "opacity-0"}`}>
          {activeYoutubeId ? (
            <iframe
              key={activeYoutubeId}
              src={`https://www.youtube.com/embed/${activeYoutubeId}?autoplay=1&mute=1&loop=1&playlist=${activeYoutubeId}&controls=0&modestbranding=1&rel=0&playsinline=1`}
              title={activeItem?.thumbnailUrl ?? ""}
              allow="autoplay; encrypted-media"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2"
            />
          ) : (
            activeVideoUrl && (
              <video
                key={activeVideoUrl}
                src={activeVideoUrl}
                autoPlay
                muted
                loop
                playsInline
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              />
            )
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-white/10 dark:from-black dark:via-black/40 dark:to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/30 to-transparent dark:from-black/90 dark:via-black/30 dark:to-transparent" />
      </div>

      <div className={`relative flex ${minHeightClassName} items-end sm:items-center`}>
        <div className="relative max-w-xl px-4 pb-8 sm:px-8 sm:pb-0">{children}</div>
      </div>
    </section>
  );
});
