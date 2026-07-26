import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SOCIAL_PLATFORMS, type SocialPlatformKey } from "@/lib/socialPlatforms";
import { GraduationCap, BarChart3, ShoppingBag } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { InstructorCourseGrid } from "@/components/instructor/InstructorCourseGrid";
import { InstructorProfileHero } from "@/components/instructor/InstructorProfileHero";
import { InstructorAccentProvider } from "@/components/instructor/InstructorAccentContext";
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
      username: true,
      role: true,
      bio: true,
      expertise: true,
      yearsExperience: true,
      image: true,
      bannerUrl: true,
      bannerType: true,
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
      resaleListingsSold: {
        where: { active: true, resaleBundleId: null },
        orderBy: { createdAt: "desc" },
        include: { course: { select: { slug: true, title: true, thumbnailUrl: true, category: true, level: true } } },
      },
      resaleBundlesSold: {
        orderBy: { createdAt: "desc" },
        include: { listings: { include: { course: { select: { title: true, thumbnailUrl: true } } } } },
      },
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

  const resaleListings = instructor.resaleListingsSold.map((listing) => ({
    id: listing.id,
    price: listing.price,
    courseSlug: listing.course.slug,
    courseTitle: listing.course.title,
    courseThumbnailUrl: listing.course.thumbnailUrl,
    courseCategory: listing.course.category,
    courseLevel: listing.course.level,
    sellerId: instructor.id,
    sellerName: instructor.name,
  }));
  const resaleBundles = instructor.resaleBundlesSold.map((bundle) => ({
    id: bundle.id,
    name: bundle.name,
    coverImageUrl: bundle.coverImageUrl ?? bundle.listings[0]?.course.thumbnailUrl ?? null,
    price: bundle.listings.reduce((sum, l) => sum + l.price, 0),
    listingCount: bundle.listings.length,
    courseTitles: bundle.listings.map((l) => l.course.title),
    sellerId: instructor.id,
    sellerName: instructor.name,
  }));

  const belowContent = (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-8">
      {isOwner && (
        <div className="mb-3 flex flex-wrap gap-2">
          <FadeLink
            href="/instructor"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <GraduationCap size={13} /> Área de Instrutor
          </FadeLink>
          <FadeLink
            href="/instructor/analytics"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <BarChart3 size={13} /> Analytics
          </FadeLink>
          <FadeLink
            href="/instructor/resale"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <ShoppingBag size={13} /> Gerir revendas
          </FadeLink>
        </div>
      )}
      <InstructorCourseGrid
        instructorFirstName={instructorFirstName}
        courses={courseCards}
        hidePriceBySlug={hidePriceBySlug}
        resaleListings={resaleListings}
        resaleBundles={resaleBundles}
      />

      <FadeLink
        href="/courses"
        className="mt-8 flex w-fit items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
      >
        ← Ver catálogo completo
      </FadeLink>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <InstructorAccentProvider imageUrl={instructor.image}>
        <InstructorProfileHero
          isOwner={isOwner}
          profileId={instructor.id}
          initialName={instructor.name}
          initialUsername={instructor.username}
          initialImage={instructor.image}
          initialBannerUrl={instructor.bannerUrl}
          initialBannerType={instructor.bannerType === "VIDEO" ? "VIDEO" : instructor.bannerUrl ? "IMAGE" : null}
          initialBio={instructor.bio ?? ""}
          initialExpertise={instructor.expertise ?? ""}
          initialYearsExperience={instructor.yearsExperience}
          initialValues={socialValues}
          initialCertifications={instructor.certifications.map((c) => ({ name: c.name, url: c.url }))}
          stats={{ avgRating, totalReviews, totalStudents, courseCount: courses.length }}
          belowContent={belowContent}
        />
      </InstructorAccentProvider>
    </div>
  );
}
