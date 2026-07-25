import { prisma } from "@/lib/db";
import { MarketplaceGrid } from "@/components/resale/MarketplaceGrid";

export const dynamic = "force-dynamic";

// Descoberta pública de revendas — sem isto, uma listagem só era alcançável
// via URL do perfil do vendedor (ver app/students/[id]/page.tsx e
// app/instructors/[id]/page.tsx, que já mostram as revendas de cada um na
// aba "À venda"). Aqui agrega todas, de todos os vendedores.
export default async function MarketplacePage() {
  const [listings, bundles] = await Promise.all([
    prisma.resaleListing.findMany({
      where: { active: true, resaleBundleId: null },
      orderBy: { createdAt: "desc" },
      include: {
        course: { select: { slug: true, title: true, thumbnailUrl: true, category: true, level: true } },
        seller: { select: { id: true, name: true } },
      },
    }),
    prisma.resaleBundle.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        seller: { select: { id: true, name: true } },
        listings: { where: { active: true }, include: { course: { select: { title: true } } } },
      },
    }),
  ]);

  const listingCards = listings.map((listing) => ({
    id: listing.id,
    price: listing.price,
    courseSlug: listing.course.slug,
    courseTitle: listing.course.title,
    courseThumbnailUrl: listing.course.thumbnailUrl,
    courseCategory: listing.course.category,
    courseLevel: listing.course.level,
    sellerId: listing.seller.id,
    sellerName: listing.seller.name,
  }));
  const bundleCards = bundles
    .filter((bundle) => bundle.listings.length > 0)
    .map((bundle) => ({
      id: bundle.id,
      name: bundle.name,
      price: bundle.listings.reduce((sum, l) => sum + l.price, 0),
      listingCount: bundle.listings.length,
      courseTitles: bundle.listings.map((l) => l.course.title),
      sellerId: bundle.seller.id,
      sellerName: bundle.seller.name,
    }));

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="border-b border-slate-200 bg-gradient-to-b from-slate-100 to-white px-4 py-5 dark:border-white/10 dark:from-slate-900 dark:to-black sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">Marketplace de Revenda</h1>
          <p className="mt-2 hidden max-w-xl text-slate-600 dark:text-slate-400 sm:block">
            Cursos e bundles revendidos por alunos e instrutores que já os terminaram.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <MarketplaceGrid listings={listingCards} bundles={bundleCards} />
      </div>
    </div>
  );
}
