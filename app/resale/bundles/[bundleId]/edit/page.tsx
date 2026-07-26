import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BundleForm } from "@/components/resale/BundleForm";

export const dynamic = "force-dynamic";

export default async function EditBundlePage({ params }: { params: Promise<{ bundleId: string }> }) {
  const { bundleId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/resale/bundles/${bundleId}/edit`)}`);

  const bundle = await prisma.resaleBundle.findUnique({
    where: { id: bundleId },
    include: { listings: { select: { listingId: true } } },
  });
  if (!bundle || bundle.sellerId !== session.user.id) notFound();

  const listings = await prisma.resaleListing.findMany({
    where: { sellerId: session.user.id, active: true },
    include: { course: { select: { title: true, thumbnailUrl: true } } },
  });

  const eligibleListings = listings.map((l) => ({
    id: l.id,
    courseTitle: l.course.title,
    price: l.price,
    thumbnailUrl: l.course.thumbnailUrl,
  }));

  return (
    <BundleForm
      mode="edit"
      bundleId={bundle.id}
      initialName={bundle.name}
      initialDescription={bundle.description ?? ""}
      initialCoverImageUrl={bundle.coverImageUrl}
      initialCategory={bundle.category}
      initialListingIds={bundle.listings.map((l) => l.listingId)}
      eligibleListings={eligibleListings}
    />
  );
}
