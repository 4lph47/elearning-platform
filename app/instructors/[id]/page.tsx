import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SOCIAL_PLATFORMS, type SocialPlatformKey } from "@/lib/socialPlatforms";
import { FadeLink } from "@/components/course/FadeLink";
import { InstructorCourseGrid } from "@/components/instructor/InstructorCourseGrid";
import { InstructorProfileHero } from "@/components/instructor/InstructorProfileHero";
import { InstructorAccentProvider } from "@/components/instructor/InstructorAccentContext";
import { InstructorHeroGradient } from "@/components/instructor/InstructorHeroGradient";
import type { CourseCardData } from "@/components/course/CourseCard";

export const dynamic = "force-dynamic";

export default async function InstructorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const instructor = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      role: true,
      bio: true,
      expertise: true,
      yearsExperience: true,
      image: true,
      websiteUrl: true,
      twitterUrl: true,
      linkedinUrl: true,
      youtubeUrl: true,
      instagramUrl: true,
      facebookUrl: true,
      tiktokUrl: true,
      githubUrl: true,
      discordUrl: true,
      mediumUrl: true,
      twitchUrl: true,
      certifications: { orderBy: { order: "asc" }, select: { id: true, name: true, url: true } },
      coursesTaught: {
        where: { published: true },
        orderBy: { createdAt: "desc" },
        include: {
          instructor: { select: { name: true } },
          modules: {
            include: {
              _count: { select: { lessons: true } },
              lessons: { orderBy: { order: "asc" }, select: { contentUrl: true, isFreePreview: true } },
            },
          },
          _count: { select: { enrollments: true } },
        },
      },
      collaboratingCourses: {
        where: { published: true },
        orderBy: { createdAt: "desc" },
        include: {
          instructor: { select: { name: true } },
          modules: {
            include: {
              _count: { select: { lessons: true } },
              lessons: { orderBy: { order: "asc" }, select: { contentUrl: true, isFreePreview: true } },
            },
          },
          _count: { select: { enrollments: true } },
        },
      },
    },
  });

  if (!instructor || (instructor.role !== "INSTRUCTOR" && instructor.role !== "ADMIN")) {
    notFound();
  }

  const courses = [...instructor.coursesTaught, ...instructor.collaboratingCourses].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const enrollments = session
    ? await prisma.enrollment.findMany({
        where: { userId: session.user.id, courseId: { in: courses.map((c) => c.id) } },
        select: { courseId: true },
      })
    : [];
  const enrolledCourseIds = new Set(enrollments.map((e) => e.courseId));
  const totalStudents = courses.reduce((sum, c) => sum + c._count.enrollments, 0);
  const ratedCourses = courses.filter((c) => c.ratingCount > 0);
  const avgRating =
    ratedCourses.length > 0
      ? ratedCourses.reduce((sum, c) => sum + c.rating * c.ratingCount, 0) /
        ratedCourses.reduce((sum, c) => sum + c.ratingCount, 0)
      : null;
  const totalReviews = courses.reduce((sum, c) => sum + c.ratingCount, 0);

  const isOwner = session?.user.id === instructor.id;
  const socialValues = Object.fromEntries(
    SOCIAL_PLATFORMS.map((p) => [p.key, instructor[p.key] ?? ""])
  ) as Record<SocialPlatformKey, string>;

  const instructorFirstName = instructor.name.split(" ")[0];
  const hidePriceBySlug: Record<string, boolean> = Object.fromEntries(
    courses.filter((c) => enrolledCourseIds.has(c.id)).map((c) => [c.slug, true])
  );
  const courseCards: CourseCardData[] = courses.map((course) => {
    const allLessons = course.modules.flatMap((m) => m.lessons);
    const trailerLesson = allLessons.find((l) => l.isFreePreview) ?? allLessons[0];
    return {
      slug: course.slug,
      title: course.title,
      description: course.description,
      category: course.category,
      level: course.level,
      thumbnailUrl: course.thumbnailUrl,
      instructorName: course.instructor.name,
      lessonCount: allLessons.length,
      price: course.price,
      rating: course.rating,
      ratingCount: course.ratingCount,
      trailerUrl: course.trailerUrl ?? trailerLesson?.contentUrl ?? null,
    };
  });

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <InstructorAccentProvider imageUrl={instructor.image}>
        {/* Gradiente "color coded" (cores da própria foto de perfil, ver
            InstructorAccentContext) — começa atrás do avatar e esmorece só
            depois de cobrir bio + redes sociais + certificações + stats,
            antes da grelha de cursos (que fica fora, em fundo normal). */}
        <InstructorHeroGradient>
          <div className="mx-auto max-w-5xl px-4 sm:px-8">
            <InstructorProfileHero
              isOwner={isOwner}
              profileId={instructor.id}
              initialName={instructor.name}
              initialImage={instructor.image}
              initialBio={instructor.bio ?? ""}
              initialExpertise={instructor.expertise ?? ""}
              initialYearsExperience={instructor.yearsExperience}
              initialValues={socialValues}
              initialCertifications={instructor.certifications.map((c) => ({ name: c.name, url: c.url }))}
              stats={{ avgRating, totalReviews, totalStudents, courseCount: courses.length }}
            />
          </div>
        </InstructorHeroGradient>

        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
          <InstructorCourseGrid
            instructorFirstName={instructorFirstName}
            courses={courseCards}
            hidePriceBySlug={hidePriceBySlug}
          />

          <FadeLink href="/courses" className="mt-8 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            ← Ver catálogo completo
          </FadeLink>
        </div>
      </InstructorAccentProvider>
    </div>
  );
}
