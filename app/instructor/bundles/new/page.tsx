import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BundleForm } from "@/components/instructor/BundleForm";

export const dynamic = "force-dynamic";

export default async function NewInstructorBundlePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent("/instructor/bundles/new")}`);

  const courses = await prisma.course.findMany({
    where: { instructorId: session.user.id, bundleId: null },
    select: { id: true, title: true, thumbnailUrl: true, price: true },
  });

  return <BundleForm mode="create" eligibleCourses={courses} />;
}
