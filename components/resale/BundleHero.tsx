"use client";

import { useEffect, useRef } from "react";
import { Pencil, Package } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import {
  boxFromRect,
  textBoxFromElement,
  useCardTransition,
} from "@/components/course/CardTransitionContext";

// Alvo real do voo disparado pelo BundleTile (BundleTile.tsx) — mesmo
// mecanismo do CourseHero, "video" carrega a capa, "title" o nome.
export function BundleHero({
  bundleId,
  name,
  description,
  coverImageUrl,
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
  sellerId: string;
  sellerName: string;
  isSellerInstructor: boolean;
  price: number;
  courseCount: number;
  isOwner: boolean;
}) {
  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { state, arrive } = useCardTransition();
  const pending = state?.slug === bundleId && !state.arrived;

  useEffect(() => {
    if (!pending) return;
    const rect = mediaBoxRef.current?.getBoundingClientRect();
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

  return (
    <div className="border-b border-slate-200 bg-gradient-to-b from-slate-900 to-black px-4 py-8 dark:border-white/10 sm:px-8 sm:py-12">
      <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-[minmax(0,22rem)_1fr]">
        <div
          ref={mediaBoxRef}
          className="relative aspect-video overflow-hidden rounded-lg bg-slate-800 ring-1 ring-white/10"
        >
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500">
              <Package size={40} />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white/70">
            <Package size={12} /> Bundle · {courseCount} curso{courseCount !== 1 ? "s" : ""}
          </span>
          <h1 ref={titleRef} className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            {name}
          </h1>
          {description && <p className="mt-3 max-w-xl text-sm text-white/70">{description}</p>}
          <FadeLink
            href={isSellerInstructor ? `/instructors/${sellerId}` : `/students/${sellerId}`}
            className="mt-3 w-fit text-sm text-white/70 hover:text-white hover:underline"
          >
            Vendido por {sellerName}
          </FadeLink>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="text-3xl font-bold text-white">{price.toFixed(2)}€</span>
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
        </div>
      </div>
    </div>
  );
}
