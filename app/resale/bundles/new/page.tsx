import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BundleForm } from "@/components/resale/BundleForm";

export const dynamic = "force-dynamic";

export default async function NewBundlePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent("/resale/bundles/new")}`);

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

  return <BundleForm mode="create" eligibleListings={eligibleListings} />;
}
