"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Package } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { MediaCarouselBackground } from "@/components/course/MediaCarouselBackground";
import {
  boxFromRect,
  textBoxFromElement,
  useCardTransition,
} from "@/components/course/CardTransitionContext";

export interface BundleHeroCourse {
  title: string;
  thumbnailUrl: string | null;
  trailerUrl: string | null;
}

// Mesmo visual/comportamento do hero da página principal (HeroCarousel) —
// fundo roda pelas thumbnails/trailers dos cursos incluídos no bundle, texto
// (nome/descrição/preço/CTA) fica fixo por cima, sempre visível. Alvo real do
// voo disparado pelo ResaleBundleTile continua a ser medido ao chegar (arrive),
// só que agora contra o hero inteiro (full-bleed), não uma caixa pequena.
export function BundleHero({
  bundleId,
  name,
  description,
  coverImageUrl,
  courses,
  sellerId,
  sellerName,
  isSellerInstructor,
  price,
  courseCount,
  isOwner,
}: {
  bundleId: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  courses: BundleHeroCourse[];
  sellerId: string;
  sellerName: string;
  isSellerInstructor: boolean;
  price: number;
  courseCount: number;
  isOwner: boolean;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { state, arrive } = useCardTransition();
  const pending = state?.slug === bundleId && !state.arrived;

  useEffect(() => {
    if (!pending) return;
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    arrive(bundleId, {
      video: boxFromRect(rect),
      title: titleRef.current ? textBoxFromElement(titleRef.current) : null,
      category: null,
      instructor: null,
      rating: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, bundleId]);

  const items = [
    ...(coverImageUrl ? [{ thumbnailUrl: coverImageUrl, videoUrl: null }] : []),
    ...courses.map((c) => ({ thumbnailUrl: c.thumbnailUrl, videoUrl: c.trailerUrl })),
  ];
  const hasMedia = items.length > 0;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 8000);
    return () => clearInterval(timer);
  }, [items.length, paused]);

  const content = (
    <>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
        <Package size={12} /> Bundle · {courseCount} curso{courseCount !== 1 ? "s" : ""}
      </span>
      <h1 ref={titleRef} className="mt-3 text-3xl font-bold text-white drop-shadow sm:text-4xl">
        {name}
      </h1>
      {description && <p className="mt-3 max-w-xl text-sm text-white/85 drop-shadow">{description}</p>}
      <FadeLink
        href={isSellerInstructor ? `/instructors/${sellerId}` : `/students/${sellerId}`}
        className="mt-3 w-fit text-sm text-white/70 hover:text-white hover:underline"
      >
        Vendido por {sellerName}
      </FadeLink>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <span className="text-3xl font-bold text-white drop-shadow">{price.toFixed(2)}€</span>
        {isOwner ? (
          <FadeLink
            href={`/resale/bundles/${bundleId}/edit`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-white/90"
          >
            <Pencil size={14} /> Editar bundle
          </FadeLink>
        ) : (
          <FadeLink
            href={`/resale/bundles/${bundleId}/checkout`}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-white/90"
          >
            Comprar bundle
          </FadeLink>
        )}
      </div>

      {items.length > 1 && (
        <div className="mt-8 flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Ver curso ${i + 1}`}
              className={`h-1 rounded-full transition-all ${
                i === index ? "w-8 bg-blue-500" : "w-4 bg-white/25 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </>
  );

  if (!hasMedia) {
    return (
      <div className="relative flex min-h-[420px] items-center overflow-hidden border-b border-slate-200 bg-gradient-to-b from-slate-900 to-black px-4 dark:border-white/10 sm:px-8">
        <div className="relative mx-auto flex max-w-5xl flex-col">{content}</div>
      </div>
    );
  }

  return (
    <MediaCarouselBackground
      ref={sectionRef}
      items={items}
      activeIndex={index}
      onHoverChange={setPaused}
      minHeightClassName="min-h-[420px] sm:min-h-[380px] lg:min-h-[480px]"
    >
      {content}
    </MediaCarouselBackground>
  );
}
