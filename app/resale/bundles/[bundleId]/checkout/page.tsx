import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckoutForm } from "@/components/course/CheckoutForm";
import { FadeLink } from "@/components/course/FadeLink";

export const dynamic = "force-dynamic";

export default async function ResaleBundleCheckoutPage({ params }: { params: Promise<{ bundleId: string }> }) {
  const { bundleId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/resale/bundles/${bundleId}/checkout`)}`);
  }

  const bundle = await prisma.resaleBundle.findUnique({
    where: { id: bundleId },
    include: {
      seller: { select: { name: true } },
      listings: {
        where: { active: true },
        include: {
          course: {
            include: {
              modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" }, select: { id: true } } } },
            },
          },
        },
      },
    },
  });
  if (!bundle || bundle.listings.length === 0 || bundle.listings.some((l) => !l.course.published)) notFound();
  if (bundle.sellerId === session.user.id) redirect("/marketplace");

  const courseIds = bundle.listings.map((l) => l.course.id);
  const existingEnrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id, courseId: { in: courseIds } },
    select: { courseId: true },
  });
  const firstCourse = bundle.listings[0].course;
  const firstLesson = firstCourse.modules.flatMap((m) => m.lessons)[0];
  const firstLessonHref = firstLesson ? `/courses/${firstCourse.slug}/lessons/${firstLesson.id}` : `/courses/${firstCourse.slug}`;
  if (existingEnrollments.length > 0) redirect(firstLessonHref);

  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-lg">
        <FadeLink
          href="/marketplace"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={14} /> Voltar ao marketplace
        </FadeLink>

        <div className="mt-4 space-y-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
            <p className="font-semibold text-slate-900 dark:text-white">{bundle.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Bundle de {bundle.seller.name}</p>
          </div>
          {bundle.listings.map((listing) => (
            <div
              key={listing.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
            >
              {listing.course.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.course.thumbnailUrl} alt={listing.course.title} className="h-14 w-20 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="h-14 w-20 shrink-0 rounded-md bg-slate-200 dark:bg-slate-800" />
              )}
              <p className="min-w-0 truncate font-semibold text-slate-900 dark:text-white">{listing.course.title}</p>
              <p className="ml-auto shrink-0 text-lg font-bold text-slate-900 dark:text-white">{listing.price.toFixed(2)}€</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <CheckoutForm
            items={bundle.listings.map((l) => ({ id: l.course.id, title: l.course.title, price: l.price }))}
            firstLessonHref={firstLessonHref}
            purchaseEndpoint={`/api/resale/bundles/${bundle.id}/purchase`}
            buildRequestBody={() => ({})}
            confirmTitle="Compra confirmada"
            confirmSubtitle={`Já tens acesso aos ${bundle.listings.length} cursos de "${bundle.name}". Bons estudos!`}
          />
        </div>
      </div>
    </div>
  );
}
