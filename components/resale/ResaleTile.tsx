"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/Card";
import type { ResaleListingCardData, ResaleBundleCardData } from "@/components/resale/types";
import {
  boxFromRect,
  findScrollAncestor,
  textBoxFromElement,
  useCardTransition,
} from "@/components/course/CardTransitionContext";

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermédio",
  advanced: "Avançado",
};

// Tile simples (sem hover-trailer/transições do CourseTile) — revenda não
// precisa disso, só thumbnail + título + preço do revendedor.
export function ResaleListingTile({ listing, showSeller = false }: { listing: ResaleListingCardData; showSeller?: boolean }) {
  return (
    <Link href={`/courses/${listing.courseSlug}?resale=${listing.id}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-800 ring-1 ring-white/10 transition-all duration-200 group-hover:ring-slate-400 dark:group-hover:ring-white/40">
        {listing.courseThumbnailUrl ? (
          <Image
            src={listing.courseThumbnailUrl}
            alt={listing.courseTitle}
            fill
            sizes="(max-width: 640px) 90vw, 320px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-slate-500">
            {listing.courseTitle.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="absolute right-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {listing.price.toFixed(2)}€
        </span>
      </div>
      <div className="mt-2.5">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-blue-600 dark:text-blue-400">{listing.courseCategory}</span>
          <span className="text-slate-400 dark:text-slate-600">·</span>
          <span className="text-slate-500 dark:text-slate-400">{LEVEL_LABEL[listing.courseLevel] ?? listing.courseLevel}</span>
        </div>
        <h3 className="mt-0.5 line-clamp-1 font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
          {listing.courseTitle}
        </h3>
        {showSeller && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Vendido por {listing.sellerName}</p>}
      </div>
    </Link>
  );
}

// Mesma estrutura/animação do CourseTile — capa em cima, texto embaixo, voo
// (CardTransitionContext/Overlay) até ao hero da página própria do bundle
// (BundleHero em app/resale/bundles/[bundleId]/page.tsx), destinationKind
// "bundle" (retângulo, ao contrário do círculo de "profile").
export function ResaleBundleTile({ bundle, showSeller = false }: { bundle: ResaleBundleCardData; showSeller?: boolean }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { state, start } = useCardTransition();
  const id = useId();
  const isTransitioning = state?.cardId === id && !state.arrived;

  function handleClick() {
    if (!mediaBoxRef.current) return;
    const videoBox = boxFromRect(mediaBoxRef.current.getBoundingClientRect());
    const titleBox = titleRef.current ? textBoxFromElement(titleRef.current) : null;
    const scrollOriginEl = findScrollAncestor(mediaBoxRef.current);

    start({
      cardId: id,
      slug: bundle.id,
      destinationKind: "bundle",
      videoRawBox: videoBox,
      titleRawBox: titleBox,
      categoryRawBox: null,
      instructorRawBox: null,
      ratingRawBox: null,
      videoBox,
      titleBox,
      categoryBox: null,
      instructorBox: null,
      ratingBox: null,
      title: bundle.name,
      category: "",
      instructorName: "",
      lessonCount: 0,
      rating: 0,
      ratingCount: 0,
      thumbnailUrl: bundle.coverImageUrl,
      videoUrl: null,
      youtubeId: null,
      videoTime: 0,
      capturedAt: Date.now(),
      scrollOriginEl,
      scrollOriginLeft: scrollOriginEl?.scrollLeft ?? 0,
      scrollOriginTop: scrollOriginEl?.scrollTop ?? 0,
    });
  }

  return (
    <Link
      ref={linkRef}
      href={`/resale/bundles/${bundle.id}`}
      className={`group block ${isTransitioning ? "pointer-events-none opacity-0" : ""}`}
      onClick={handleClick}
    >
      <div
        ref={mediaBoxRef}
        className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 ring-1 ring-white/10 transition-all duration-200 group-hover:ring-slate-400 dark:group-hover:ring-white/40"
      >
        {bundle.coverImageUrl ? (
          <Image
            src={bundle.coverImageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, 320px"
            className="object-cover"
          />
        ) : (
          <Package size={32} className="text-slate-500" />
        )}
        <span className="absolute left-2 top-2">
          <Badge tone="info">{bundle.listingCount} cursos</Badge>
        </span>
        <span className="absolute right-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {bundle.price.toFixed(2)}€
        </span>
      </div>
      <div className="mt-2.5">
        <h3
          ref={titleRef}
          className="line-clamp-1 font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400"
        >
          {bundle.name}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
          Inclui: {bundle.courseTitles.join(", ")}
        </p>
        {showSeller && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Vendido por {bundle.sellerName}</p>}
      </div>
    </Link>
  );
}
