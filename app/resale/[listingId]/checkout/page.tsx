import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckoutForm } from "@/components/course/CheckoutForm";

export const dynamic = "force-dynamic";

export default async function ResaleListingCheckoutPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/resale/${listingId}/checkout`)}`);
  }

  const listing = await prisma.resaleListing.findUnique({
    where: { id: listingId },
    include: {
      seller: { select: { name: true } },
      course: {
        include: {
          modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" }, select: { id: true } } } },
        },
      },
    },
  });
  if (!listing || !listing.active || !listing.course.published) notFound();
  if (listing.sellerId === session.user.id) redirect(`/courses/${listing.course.slug}`);

  const existingEnrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: listing.course.id } },
  });
  const firstLesson = listing.course.modules.flatMap((m) => m.lessons)[0];
  const firstLessonHref = firstLesson
    ? `/courses/${listing.course.slug}/lessons/${firstLesson.id}`
    : `/courses/${listing.course.slug}`;
  if (existingEnrollment) redirect(firstLessonHref);

  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-lg">
        <Link
          href={`/courses/${listing.course.slug}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft size={14} /> Voltar ao curso
        </Link>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
          {listing.course.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.course.thumbnailUrl} alt={listing.course.title} className="h-14 w-20 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="h-14 w-20 shrink-0 rounded-md bg-slate-200 dark:bg-slate-800" />
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-white">{listing.course.title}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Revenda de {listing.seller.name}</p>
          </div>
          <p className="ml-auto shrink-0 text-lg font-bold text-slate-900 dark:text-white">{listing.price.toFixed(2)}€</p>
        </div>

        <div className="mt-6">
          <CheckoutForm
            items={[{ id: listing.course.id, title: listing.course.title, price: listing.price }]}
            firstLessonHref={firstLessonHref}
            purchaseEndpoint={`/api/resale/${listing.id}/purchase`}
            buildRequestBody={() => ({})}
            confirmTitle="Compra confirmada"
            confirmSubtitle={`Já tens acesso a ${listing.course.title}. Bons estudos!`}
          />
        </div>
      </div>
    </div>
  );
}
