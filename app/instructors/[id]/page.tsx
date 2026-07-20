import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Star, Users, BookOpen, MessageSquare, Globe, Link2 } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CourseTile } from "@/components/course/CourseTile";

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
      websiteUrl: true,
      twitterUrl: true,
      linkedinUrl: true,
      youtubeUrl: true,
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
  const backdropUrl = courses.find((c) => c.thumbnailUrl)?.thumbnailUrl ?? null;

  const socialLinks = [
    { url: instructor.websiteUrl, label: "Website", icon: Globe },
    { url: instructor.twitterUrl, label: "Twitter/X", icon: Link2 },
    { url: instructor.linkedinUrl, label: "LinkedIn", icon: Link2 },
    { url: instructor.youtubeUrl, label: "YouTube", icon: Link2 },
  ].filter((s): s is { url: string; label: string; icon: typeof Globe } => Boolean(s.url));

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="relative overflow-hidden border-b border-slate-200 dark:border-white/10">
        <div className="absolute inset-0">
          {backdropUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={backdropUrl} alt="" className="h-full w-full scale-110 object-cover blur-2xl" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-950 via-slate-900 to-black" />
          )}
          <div className="absolute inset-0 bg-black/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/40" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-8 sm:py-20">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-3xl font-bold text-white shadow-lg shadow-blue-950/40 ring-4 ring-black/40">
            {initials(instructor.name)}
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-blue-400">Instrutor</p>
          <h1 className="mt-1 text-3xl font-bold text-white sm:text-5xl">{instructor.name}</h1>

          {instructor.bio && (
            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-slate-300">{instructor.bio}</p>
          )}

          {socialLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {socialLinks.map(({ url, label, icon: Icon }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-slate-300 hover:border-blue-500/60 hover:text-white"
                >
                  <Icon size={13} /> {label}
                </a>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-300">
            {avgRating !== null && (
              <span className="flex items-center gap-1.5">
                <Star size={15} className="fill-blue-400 text-blue-400" /> {avgRating.toFixed(1)} média
              </span>
            )}
            {totalReviews > 0 && (
              <span className="flex items-center gap-1.5">
                <MessageSquare size={15} className="text-blue-400" /> {totalReviews} avaliaç{totalReviews !== 1 ? "ões" : "ão"}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users size={15} className="text-blue-400" /> {totalStudents} aluno{totalStudents !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen size={15} className="text-blue-400" /> {courses.length} curso{courses.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
        <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-white">Cursos de {instructor.name.split(" ")[0]}</h2>
        {courses.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">Ainda não tem cursos publicados.</p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const allLessons = course.modules.flatMap((m) => m.lessons);
              const trailerLesson = allLessons.find((l) => l.isFreePreview) ?? allLessons[0];
              return (
                <CourseTile
                  key={course.id}
                  course={{
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
                  }}
                  hidePrice={enrolledCourseIds.has(course.id)}
                />
              );
            })}
          </div>
        )}

        <Link href="/courses" className="mt-8 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
          ← Ver catálogo completo
        </Link>
      </div>
    </div>
  );
}
