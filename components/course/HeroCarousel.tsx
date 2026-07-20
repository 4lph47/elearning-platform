"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getYouTubeId } from "@/lib/youtube";
import type { CourseCardData } from "@/components/course/CourseCard";

export interface HeroCarouselItem {
  card: CourseCardData;
  videoUrl: string | null;
}

export function HeroCarousel({ items }: { items: HeroCarouselItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Texto atrasa a troca do fundo: desaparece logo, espera 1s e só depois
  // mostra o texto do novo slide (em vez de trocar tudo em simultâneo).
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

  const featured = items[index].card;
  const activeVideoUrl = items[index].videoUrl;
  const activeYoutubeId = activeVideoUrl ? getYouTubeId(activeVideoUrl) : null;
  const textCard = items[textIndex].card;

  return (
    <section
      className="relative min-h-[520px] overflow-hidden sm:min-h-[460px] lg:min-h-[600px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0">
        {items.map((item, i) => (
          <div
            key={item.card.slug}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {item.card.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.card.thumbnailUrl} alt={item.card.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-slate-200 dark:bg-slate-900" />
            )}
          </div>
        ))}

        {activeYoutubeId ? (
          <iframe
            key={activeYoutubeId}
            src={`https://www.youtube.com/embed/${activeYoutubeId}?autoplay=1&mute=1&loop=1&playlist=${activeYoutubeId}&controls=0&modestbranding=1&rel=0&playsinline=1`}
            title={featured.title}
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

        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-white/10 dark:from-black dark:via-black/40 dark:to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/30 to-transparent dark:from-black/90 dark:via-black/30 dark:to-transparent" />
      </div>

      <div className="relative flex min-h-[520px] items-end sm:min-h-[460px] sm:items-center lg:min-h-[600px]">
        <div className="relative max-w-xl px-4 pb-8 sm:px-8 sm:pb-0">
          <div
            className={`transition-all duration-500 ${
              textVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
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
              <Link href={`/courses/${textCard.slug}`}>
                <Button variant="accent">
                  <BookOpen size={16} /> Inscrever-me
                </Button>
              </Link>
              <Link href={`/courses/${textCard.slug}`}>
                <Button variant="outline-dark">
                  <Info size={16} /> Mais informações
                </Button>
              </Link>
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
        </div>
      </div>
    </section>
  );
}
