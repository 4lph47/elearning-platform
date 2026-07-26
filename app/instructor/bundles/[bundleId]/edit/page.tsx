import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BundleForm } from "@/components/instructor/BundleForm";

export const dynamic = "force-dynamic";

export default async function EditInstructorBundlePage({ params }: { params: Promise<{ bundleId: string }> }) {
  const { bundleId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/instructor/bundles/${bundleId}/edit`)}`);

  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId },
    include: { courses: { select: { id: true } } },
  });
  if (!bundle || bundle.instructorId !== session.user.id) notFound();

  const courses = await prisma.course.findMany({
    where: { instructorId: session.user.id, OR: [{ bundleId: null }, { bundleId }] },
    select: { id: true, title: true, thumbnailUrl: true, price: true },
  });

  return (
    <BundleForm
      mode="edit"
      bundleId={bundle.id}
      initialName={bundle.name}
      initialCategory={bundle.category}
      initialCourseIds={bundle.courses.map((c) => c.id)}
      eligibleCourses={courses}
    />
  );
}
