import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BundleHero } from "@/components/resale/BundleHero";
import { FadeLink } from "@/components/course/FadeLink";

export const dynamic = "force-dynamic";

// Página própria do bundle (browsable, tipo /courses/[slug]) — o checkout
// (app/resale/bundles/[bundleId]/checkout) continua só o passo de compra,
// que redireciona logo quem já é dono/vendedor. Esta é quem qualquer
// visitante vê ao clicar num BundleTile.
export default async function BundlePage({ params }: { params: Promise<{ bundleId: string }> }) {
  const { bundleId } = await params;
  const session = await getServerSession(authOptions);

  const bundle = await prisma.resaleBundle.findUnique({
    where: { id: bundleId },
    include: {
      seller: { select: { id: true, name: true, role: true } },
      listings: {
        where: { active: true },
        include: { course: { select: { slug: true, title: true, thumbnailUrl: true, category: true, level: true } } },
      },
    },
  });
  if (!bundle || bundle.listings.length === 0) notFound();

  const isOwner = session?.user.id === bundle.sellerId;
  const price = bundle.listings.reduce((sum, l) => sum + l.price, 0);

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <BundleHero
        bundleId={bundle.id}
        name={bundle.name}
        description={bundle.description}
        coverImageUrl={bundle.coverImageUrl}
        sellerId={bundle.seller.id}
        sellerName={bundle.seller.name}
        isSellerInstructor={bundle.seller.role === "INSTRUCTOR"}
        price={price}
        courseCount={bundle.listings.length}
        isOwner={isOwner}
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Cursos incluídos</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {bundle.listings.map((listing) => (
            <FadeLink
              key={listing.id}
              href={`/courses/${listing.course.slug}?resale=${listing.id}`}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30"
            >
              {listing.course.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.course.thumbnailUrl}
                  alt=""
                  className="h-16 w-24 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="h-16 w-24 shrink-0 rounded-md bg-slate-200 dark:bg-slate-800" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                  {listing.course.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{listing.course.category}</p>
              </div>
              <span className="shrink-0 font-semibold text-slate-900 dark:text-white">{listing.price.toFixed(2)}€</span>
            </FadeLink>
          ))}
        </div>
      </div>
    </div>
  );
}
