import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FadeLink } from "@/components/course/FadeLink";
import { ManageResaleSection } from "@/components/resale/ManageResaleSection";

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
      include: { course: { select: { id: true, title: true, slug: true } }, _count: { select: { sales: true } } },
    }),
    prisma.resaleBundle.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: "desc" },
      include: { listings: { select: { id: true } } },
    }),
  ]);

  const listedCourseIds = new Set(ownListings.map((l) => l.courseId));
  const eligibleCourses = completedCourses
    .filter((e) => !listedCourseIds.has(e.course.id))
    .map((e) => ({ id: e.course.id, title: e.course.title, minCommission: e.course.resaleMinCommission! }));
  const listings = ownListings.map((l) => ({
    id: l.id,
    price: l.price,
    active: l.active,
    courseId: l.courseId,
    courseTitle: l.course.title,
    courseSlug: l.course.slug,
    bundleId: l.resaleBundleId,
    salesCount: l._count.sales,
  }));
  const bundles = ownBundles.map((b) => ({ id: b.id, name: b.name, listingIds: b.listings.map((l) => l.id) }));

  const hasNothing = eligibleCourses.length === 0 && listings.length === 0 && bundles.length === 0;

  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-black sm:px-6">
      <div className="mx-auto max-w-3xl">
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
          <p className="text-slate-500 dark:text-slate-400">
            Ainda não tens nada para vender — termina um curso de outro instrutor com revenda ativada para poderes revendê-lo aqui.
          </p>
        ) : (
          <ManageResaleSection eligibleCourses={eligibleCourses} listings={listings} bundles={bundles} />
        )}
      </div>
    </div>
  );
}
