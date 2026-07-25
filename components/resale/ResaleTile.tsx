import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Card";
import type { ResaleListingCardData, ResaleBundleCardData } from "@/components/resale/types";

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

export function ResaleBundleTile({ bundle, showSeller = false }: { bundle: ResaleBundleCardData; showSeller?: boolean }) {
  return (
    <Link href={`/resale/bundles/${bundle.id}/checkout`} className="group block">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 p-4 ring-1 ring-white/10 transition-all duration-200 group-hover:ring-slate-400 dark:group-hover:ring-white/40">
        <div className="text-center">
          <Badge tone="info">{bundle.listingCount} cursos</Badge>
          <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">{bundle.name}</p>
        </div>
        <span className="absolute right-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          {bundle.price.toFixed(2)}€
        </span>
      </div>
      <div className="mt-2.5">
        <h3 className="line-clamp-1 font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
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
