import Image from "next/image";
import { PersonTile } from "@/components/course/PersonTile";
import { ResaleBundleTile, ResaleListingTile } from "@/components/resale/ResaleTile";
import type { ResaleBundleCardData, ResaleListingCardData } from "@/components/resale/types";
import { FadeLink } from "@/components/course/FadeLink";
import { HorizontalScrollRow } from "@/components/course/HorizontalScrollRow";

export interface PersonResult {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}

// Bundle criado pelo próprio instrutor (Bundle, não ResaleBundle) — sem
// página/checkout próprios, por isso sem o voo do ResaleBundleTile: leva
// direto ao perfil de quem o vende.
export interface InstructorBundleResult {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  priceLabel: string;
  subtitle: string;
  href: string;
}

// Resultados de pesquisa que não são cursos — pessoas e bundles. Pessoas e
// bundles de revenda usam a mesma estrutura/animação dos cards de curso
// (PersonTile/ResaleBundleTile reaproveitam o CardTransitionContext do
// CourseTile: capa/avatar em cima, texto embaixo, voo até à página própria).
export function PeopleRow({ people }: { people: PersonResult[] }) {
  if (people.length === 0) return null;
  return (
    <HorizontalScrollRow title="Pessoas">
      {people.map((p) => (
        <div key={p.id} className="w-28 shrink-0 sm:w-32">
          <PersonTile person={p} />
        </div>
      ))}
    </HorizontalScrollRow>
  );
}

export function BundlesRow({
  resaleBundles,
  instructorBundles,
}: {
  resaleBundles: ResaleBundleCardData[];
  instructorBundles: InstructorBundleResult[];
}) {
  if (resaleBundles.length === 0 && instructorBundles.length === 0) return null;
  return (
    <HorizontalScrollRow title="Bundles">
      {resaleBundles.map((b) => (
        <div key={b.id} className="w-64 shrink-0 sm:w-72">
          <ResaleBundleTile bundle={b} showSeller />
        </div>
      ))}
      {instructorBundles.map((b) => (
        <div key={b.id} className="w-64 shrink-0 sm:w-72">
          <FadeLink href={b.href} className="group block">
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 p-4 ring-1 ring-white/10 transition-all duration-200 group-hover:ring-slate-400 dark:group-hover:ring-white/40">
              {b.thumbnailUrl && (
                <Image
                  src={b.thumbnailUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 90vw, 320px"
                  className="object-cover opacity-30"
                />
              )}
              <p className="relative z-10 line-clamp-2 text-center text-sm font-semibold text-white">{b.name}</p>
              <span className="absolute right-2 top-2 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {b.priceLabel}
              </span>
            </div>
            <div className="mt-2.5">
              <h3 className="line-clamp-1 font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {b.name}
              </h3>
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{b.subtitle}</p>
            </div>
          </FadeLink>
        </div>
      ))}
    </HorizontalScrollRow>
  );
}

// Filtro "Revendas" próprio (distinto de "Bundles", que também inclui
// pacotes criados pelo próprio instrutor) — cursos individuais revendidos
// (ResaleListing sem bundle) e bundles de revenda (ResaleBundle), nunca
// aparecendo de outra forma no catálogo antes disto.
export function ResaleRow({
  listings,
  bundles,
}: {
  listings: ResaleListingCardData[];
  bundles: ResaleBundleCardData[];
}) {
  if (listings.length === 0 && bundles.length === 0) return null;
  return (
    <HorizontalScrollRow title="Revendas">
      {bundles.map((b) => (
        <div key={b.id} className="w-64 shrink-0 sm:w-72">
          <ResaleBundleTile bundle={b} showSeller />
        </div>
      ))}
      {listings.map((l) => (
        <div key={l.id} className="w-64 shrink-0 sm:w-72">
          <ResaleListingTile listing={l} showSeller />
        </div>
      ))}
    </HorizontalScrollRow>
  );
}
