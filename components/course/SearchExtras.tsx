import Link from "next/link";
import Image from "next/image";

export interface PersonResult {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN";
}

export interface BundleResult {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  priceLabel: string;
  subtitle: string;
  href: string;
}

const ROLE_LABEL: Record<PersonResult["role"], string> = {
  STUDENT: "Aluno",
  INSTRUCTOR: "Instrutor",
  ADMIN: "Admin",
};

// Resultados de pesquisa que não são cursos — pessoas e bundles. Visual
// consistente com os tiles do catálogo/marketplace (aspect-video, ring,
// hover) mesmo sem reaproveitar o PosterCard/CourseRow (esses são feitos à
// medida de CourseCardData, não dá para forçar pessoas/bundles lá dentro).
export function PeopleRow({ people }: { people: PersonResult[] }) {
  if (people.length === 0) return null;
  return (
    <section className="py-5">
      <h2 className="mb-3 px-4 text-lg font-semibold text-slate-900 dark:text-white sm:px-8 sm:text-xl">Pessoas</h2>
      <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-8 lg:grid-cols-4">
        {people.map((p) => (
          <Link
            key={p.id}
            href={p.role === "STUDENT" ? `/students/${p.id}` : `/instructors/${p.id}`}
            className="group flex items-center gap-3 rounded-lg p-2 ring-1 ring-transparent transition-colors hover:ring-slate-300 dark:hover:ring-white/20"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/10">
              {p.image ? (
                <Image src={p.image} alt={p.name} width={48} height={48} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-slate-400">{p.name.charAt(0).toUpperCase()}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {p.name}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {p.username ? `@${p.username} · ` : ""}
                {ROLE_LABEL[p.role]}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function BundlesRow({ bundles }: { bundles: BundleResult[] }) {
  if (bundles.length === 0) return null;
  return (
    <section className="py-5">
      <h2 className="mb-3 px-4 text-lg font-semibold text-slate-900 dark:text-white sm:px-8 sm:text-xl">Bundles</h2>
      <div className="grid grid-cols-1 gap-x-6 gap-y-10 px-4 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
        {bundles.map((b) => (
          <Link key={b.id} href={b.href} className="group block">
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
          </Link>
        ))}
      </div>
    </section>
  );
}
