import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FadeLink } from "@/components/course/FadeLink";
import { ManageResaleSection } from "@/components/resale/ManageResaleSection";
import type { ResaleListingCardData, ResaleBundleCardData } from "@/components/resale/types";

export const dynamic = "force-dynamic";

// Página própria (antes vivia dentro de app/instructors/[id]/page.tsx) —
// igual ao padrão já usado para Analytics (app/instructor/analytics), só o
// dono vê isto, acessível pelo botão "Gerir revendas" no perfil público.
export default async function InstructorResalePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/instructor/resale");

  const userId = session.user.id;

  // Cursos de OUTROS instrutores em que este se inscreveu e já terminou —
  // nunca os seus próprios (nem os que co-ensina), mesma regra de lib/resale.ts.
  const [completedCourses, ownListings, ownBundles] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        userId,
        completedAt: { not: null },
        course: {
          resaleMinCommission: { not: null },
          instructorId: { not: userId },
          collaborators: { none: { id: userId } },
        },
      },
      select: { course: { select: { id: true, title: true, resaleMinCommission: true } } },
    }),
    prisma.resaleListing.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { slug: true, title: true, thumbnailUrl: true, category: true, level: true } },
      },
    }),
    prisma.resaleBundle.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      include: { listings: { include: { course: { select: { title: true, thumbnailUrl: true, category: true } } } } },
    }),
  ]);

  const listedCourseIds = new Set(ownListings.map((l) => l.courseId));
  const eligibleCourses = completedCourses
    .filter((e) => !listedCourseIds.has(e.course.id))
    .map((e) => ({ id: e.course.id, title: e.course.title, minCommission: e.course.resaleMinCommission! }));

  const listings: ResaleListingCardData[] = ownListings.map((l) => ({
    id: l.id,
    price: l.price,
    courseSlug: l.course.slug,
    courseTitle: l.course.title,
    courseThumbnailUrl: l.course.thumbnailUrl,
    courseCategory: l.course.category,
    courseLevel: l.course.level,
    sellerId: userId,
    sellerName: session.user.name ?? "",
    active: l.active,
  }));
  const bundles: ResaleBundleCardData[] = ownBundles.map((b) => ({
    id: b.id,
    name: b.name,
    coverImageUrl: b.coverImageUrl ?? b.listings[0]?.course.thumbnailUrl ?? null,
    price: b.listings.reduce((sum, l) => sum + l.price, 0),
    listingCount: b.listings.length,
    courseTitles: b.listings.map((l) => l.course.title),
    sellerId: userId,
    sellerName: session.user.name ?? "",
    category: b.listings[0]?.course.category ?? "Outros",
  }));
  const canCreateBundle = ownListings.some((l) => l.active && !l.resaleBundleId);

  const hasNothing = eligibleCourses.length === 0 && listings.length === 0 && bundles.length === 0;

  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gerir revendas</h1>
            <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
              Cursos que podes revender, as tuas listagens e bundles.
            </p>
          </div>
          <FadeLink
            href="/instructor"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            ← Voltar à área de instrutor
          </FadeLink>
        </div>

        {hasNothing ? (
          <p className="px-4 text-slate-500 dark:text-slate-400 sm:px-0">
            Ainda não tens nada para vender — termina um curso de outro instrutor com revenda ativada para poderes revendê-lo aqui.
          </p>
        ) : (
          <ManageResaleSection
            eligibleCourses={eligibleCourses}
            listings={listings}
            bundles={bundles}
            canCreateBundle={canCreateBundle}
          />
        )}
      </div>
    </div>
  );
}
