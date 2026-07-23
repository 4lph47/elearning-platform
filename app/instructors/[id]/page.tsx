import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Star, Users, BookOpen, MessageSquare, Globe, Link2, Award } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SOCIAL_PLATFORMS } from "@/lib/socialPlatforms";
import { FadeLink } from "@/components/course/FadeLink";
import { InstructorCourseGrid } from "@/components/instructor/InstructorCourseGrid";
import { InstructorAccentProvider } from "@/components/instructor/InstructorAccentContext";
import { InstructorHeroGradient } from "@/components/instructor/InstructorHeroGradient";
import type { CourseCardData } from "@/components/course/CourseCard";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

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

  const socialLinks = SOCIAL_PLATFORMS.map((p) => ({
    url: instructor[p.key],
    label: p.label,
    icon: p.key === "websiteUrl" ? Globe : Link2,
  })).filter((s): s is { url: string; label: string; icon: typeof Globe } => Boolean(s.url));

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
            {instructor.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={instructor.image}
                alt={instructor.name}
                className="h-24 w-24 rounded-full object-cover shadow-lg shadow-black/30 ring-4 ring-white/30"
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-3xl font-bold text-white shadow-lg shadow-black/30 ring-4 ring-white/30 backdrop-blur">
                {initials(instructor.name)}
              </span>
            )}
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-white/70">Instrutor</p>
            <h1 className="mt-1 text-3xl font-bold text-white sm:text-5xl">{instructor.name}</h1>

            {instructor.bio && (
              <p className="mt-3 max-w-2xl whitespace-pre-wrap text-white/85">{instructor.bio}</p>
            )}

            {socialLinks.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {socialLinks.map(({ url, label, icon: Icon }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20"
                  >
                    <Icon size={13} /> {label}
                  </a>
                ))}
              </div>
            )}

            {instructor.certifications.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {instructor.certifications.map((cert) => (
                  <a
                    key={cert.id}
                    href={cert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20"
                  >
                    <Award size={13} /> {cert.name}
                  </a>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/85">
              {avgRating !== null && (
                <span className="flex items-center gap-1.5">
                  <Star size={15} className="fill-white text-white" /> {avgRating.toFixed(1)} média
                </span>
              )}
              {totalReviews > 0 && (
                <span className="flex items-center gap-1.5">
                  <MessageSquare size={15} /> {totalReviews} avaliaç{totalReviews !== 1 ? "ões" : "ão"}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users size={15} /> {totalStudents} aluno{totalStudents !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen size={15} /> {courses.length} curso{courses.length !== 1 ? "s" : ""}
              </span>
            </div>
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
