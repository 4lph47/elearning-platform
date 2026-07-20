"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 8000);
    return () => clearInterval(timer);
  }, [items.length, paused]);

  const featured = items[index].card;
  const activeVideoUrl = items[index].videoUrl;
  const activeYoutubeId = activeVideoUrl ? getYouTubeId(activeVideoUrl) : null;

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
              <div className="h-full w-full bg-slate-900" />
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

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/30 to-transparent" />
      </div>

      <div className="relative flex min-h-[520px] items-end sm:min-h-[460px] sm:items-center lg:min-h-[600px]">
        <div className="max-w-xl px-4 pb-8 sm:px-8 sm:pb-0">
          <span className="inline-block rounded bg-blue-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
            {featured.category}
          </span>
          <h1 className="mt-3 text-3xl font-bold text-white drop-shadow sm:text-5xl">{featured.title}</h1>
          <p className="mt-3 line-clamp-3 text-sm text-slate-200 drop-shadow sm:text-base">{featured.description}</p>
          <div className="mt-6 flex gap-3">
            <Link href={`/courses/${featured.slug}`}>
              <Button variant="accent">
                <BookOpen size={16} /> Inscrever-me
              </Button>
            </Link>
            <Link href={`/courses/${featured.slug}`}>
              <Button variant="outline-dark">
                <Info size={16} /> Mais informações
              </Button>
            </Link>
          </div>

          {items.length > 1 && (
            <div className="mt-8 flex gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.card.slug}
                  onClick={() => setIndex(i)}
                  aria-label={`Ver ${item.card.title}`}
                  className={`h-1 rounded-full transition-all ${
                    i === index ? "w-8 bg-blue-500" : "w-4 bg-white/30 hover:bg-white/50"
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
