import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CreateResaleListingForm } from "@/components/resale/CreateResaleListingForm";

export const dynamic = "force-dynamic";

// Página dedicada para criar uma revenda — espelha /resale/bundles/new.
// Elegível = terminaste o curso, o instrutor ativou a revenda nele, não és
// tu o instrutor/colaborador desse curso, e ainda não o tens listado.
export default async function NewResaleListingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent("/resale/listings/new")}`);

  const userId = session.user.id;

  const [completedCourses, ownListings] = await Promise.all([
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
      select: {
        course: { select: { id: true, title: true, thumbnailUrl: true, resaleMinCommission: true } },
      },
    }),
    prisma.resaleListing.findMany({ where: { sellerId: userId }, select: { courseId: true } }),
  ]);

  const listedCourseIds = new Set(ownListings.map((l) => l.courseId));
  const eligibleCourses = completedCourses
    .filter((e) => !listedCourseIds.has(e.course.id))
    .map((e) => ({
      id: e.course.id,
      title: e.course.title,
      thumbnailUrl: e.course.thumbnailUrl,
      minCommission: e.course.resaleMinCommission!,
    }));

  return <CreateResaleListingForm eligibleCourses={eligibleCourses} />;
}
