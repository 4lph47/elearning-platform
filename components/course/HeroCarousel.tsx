"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CourseCardData } from "@/components/course/CourseCard";
import { FadeLink } from "@/components/course/FadeLink";
import { MediaCarouselBackground } from "@/components/course/MediaCarouselBackground";

export interface HeroCarouselItem {
  card: CourseCardData;
  videoUrl: string | null;
}

export function HeroCarousel({ items }: { items: HeroCarouselItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Texto atrasa a troca do fundo: desaparece logo, espera 1s e só depois
  // mostra o texto do novo slide (em vez de trocar tudo em simultâneo). O
  // atraso do próprio fundo (thumbnail/vídeo) é interno ao MediaCarouselBackground.
  const [textIndex, setTextIndex] = useState(0);
  const [textVisible, setTextVisible] = useState(true);
  const mounted = useRef(false);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 8000);
    return () => clearInterval(timer);
  }, [items.length, paused]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setTextVisible(false);
    const timer = setTimeout(() => {
      setTextIndex(index);
      setTextVisible(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [index]);

  const textCard = items[textIndex].card;

  return (
    <MediaCarouselBackground
      items={items.map((item) => ({ thumbnailUrl: item.card.thumbnailUrl, videoUrl: item.videoUrl }))}
      activeIndex={index}
      onHoverChange={setPaused}
      onSwipe={(direction) =>
        setIndex((i) => (direction === "left" ? (i + 1) % items.length : (i - 1 + items.length) % items.length))
      }
    >
      <div
        className={`transition-all duration-500 ${textVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      >
        <span className="inline-block rounded bg-blue-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
          {textCard.category}
        </span>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 drop-shadow-sm dark:text-white dark:drop-shadow sm:text-5xl">
          {textCard.title}
        </h1>
        <p className="mt-3 line-clamp-3 text-sm text-slate-700 drop-shadow-sm dark:text-slate-200 dark:drop-shadow sm:text-base">
          {textCard.description}
        </p>
        <div className="mt-6 flex gap-3">
          <FadeLink href={`/courses/${textCard.slug}`}>
            <Button variant="accent">
              <BookOpen size={16} /> Inscrever-me
            </Button>
          </FadeLink>
          <FadeLink href={`/courses/${textCard.slug}`}>
            <Button variant="outline-dark">
              <Info size={16} /> Mais informações
            </Button>
          </FadeLink>
        </div>
      </div>

      {items.length > 1 && (
        <div className="mt-8 flex gap-1.5">
          {items.map((item, i) => (
            <button
              key={item.card.slug}
              onClick={() => setIndex(i)}
              aria-label={`Ver ${item.card.title}`}
              className={`h-1 rounded-full transition-all ${
                i === index
                  ? "w-8 bg-blue-500"
                  : "w-4 bg-slate-900/20 hover:bg-slate-900/40 dark:bg-white/30 dark:hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </MediaCarouselBackground>
  );
}
