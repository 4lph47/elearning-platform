import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SOCIAL_PLATFORMS, type SocialPlatformKey } from "@/lib/socialPlatforms";
import { BookOpen, Settings, BarChart3, ShoppingBag } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";
import { StudentCourseGrid } from "@/components/student/StudentCourseGrid";
import { StudentProfileHero } from "@/components/student/StudentProfileHero";
import { InstructorAccentProvider } from "@/components/instructor/InstructorAccentContext";
import type { CommunityCardData } from "@/components/community/CommunityTile";
import type { CourseCardData } from "@/components/course/CourseCard";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const student = await prisma.user.findUnique({
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
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        include: {
          course: {
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
      },
      _count: { select: { reviews: true } },
    },
  });

  if (!student) {
    notFound();
  }
  // Instrutores/admins já têm a própria página pública dedicada.
  if (student.role === "INSTRUCTOR") {
    redirect(`/instructors/${id}`);
  }

  const isOwner = session?.user.id === student.id;
  const socialValues = Object.fromEntries(
    SOCIAL_PLATFORMS.map((p) => [p.key, student[p.key] ?? ""])
  ) as Record<SocialPlatformKey, string>;

  const watchedSecondsAgg = await prisma.lessonProgress.aggregate({
    where: { userId: student.id },
    _sum: { watchedSeconds: true },
  });
  const totalHours = Math.round((watchedSecondsAgg._sum.watchedSeconds ?? 0) / 3600);

  const studentFirstName = student.name.split(" ")[0];
  const courses = student.enrollments.map((e) => e.course);
  // São todos cursos em que o aluno já está inscrito — mostrar preço não faz sentido aqui.
  const hidePriceBySlug: Record<string, boolean> = Object.fromEntries(courses.map((c) => [c.slug, true]));
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

  const resaleListings = student.resaleListingsSold.map((listing) => ({
    id: listing.id,
    price: listing.price,
    courseSlug: listing.course.slug,
    courseTitle: listing.course.title,
    courseThumbnailUrl: listing.course.thumbnailUrl,
    courseCategory: listing.course.category,
    courseLevel: listing.course.level,
    sellerId: student.id,
    sellerName: student.name,
  }));
  const resaleBundles = student.resaleBundlesSold.map((bundle) => ({
    id: bundle.id,
    name: bundle.name,
    coverImageUrl: bundle.coverImageUrl ?? bundle.listings[0]?.course.thumbnailUrl ?? null,
    price: bundle.listings.reduce((sum, l) => sum + l.price, 0),
    listingCount: bundle.listings.length,
    courseTitles: bundle.listings.map((l) => l.course.title),
    sellerId: student.id,
    sellerName: student.name,
  }));

  // Dono vê todas as suas comunidades; visitante só as que tem em comum com
  // este perfil (interseção das duas listas de membership) — nunca as
  // comunidades do visitante que este perfil não partilha.
  const theirCommunityIds = (
    await prisma.communityMember.findMany({ where: { userId: student.id }, select: { communityId: true } })
  ).map((m) => m.communityId);
  const myCommunityIds = session
    ? (await prisma.communityMember.findMany({ where: { userId: session.user.id }, select: { communityId: true } })).map(
        (m) => m.communityId
      )
    : [];
  const relevantCommunityIds = isOwner ? theirCommunityIds : theirCommunityIds.filter((id) => myCommunityIds.includes(id));
  const sharedCommunities =
    relevantCommunityIds.length > 0
      ? await prisma.community.findMany({
          where: { id: { in: relevantCommunityIds } },
          include: { _count: { select: { members: true } } },
        })
      : [];
  const communityCards: CommunityCardData[] = sharedCommunities.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    coverImageUrl: c.coverImageUrl,
    memberCount: c._count.members,
  }));

  const belowContent = (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-8">
      {isOwner && (
        <div className="mb-3 flex flex-wrap gap-2">
          <FadeLink
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <BookOpen size={13} /> A minha aprendizagem
          </FadeLink>
          <FadeLink
            href="/dashboard/analytics"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <BarChart3 size={13} /> Analytics
          </FadeLink>
          <FadeLink
            href="/dashboard/resale"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <ShoppingBag size={13} /> Gerir revendas
          </FadeLink>
          <FadeLink
            href="/account"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <Settings size={13} /> Definições
          </FadeLink>
        </div>
      )}
      <StudentCourseGrid
        studentFirstName={studentFirstName}
        courses={courseCards}
        hidePriceBySlug={hidePriceBySlug}
        resaleListings={resaleListings}
        resaleBundles={resaleBundles}
        communities={communityCards}
        communitiesTitle={isOwner ? "As tuas comunidades" : "Comunidades em comum"}
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
      <InstructorAccentProvider imageUrl={student.image}>
        <StudentProfileHero
          isOwner={isOwner}
          profileId={student.id}
          initialName={student.name}
          initialUsername={student.username}
          initialImage={student.image}
          initialBannerUrl={student.bannerUrl}
          initialBannerType={student.bannerType === "VIDEO" ? "VIDEO" : student.bannerUrl ? "IMAGE" : null}
          initialBio={student.bio ?? ""}
          initialInterestArea={student.expertise ?? ""}
          initialYearsLearning={student.yearsExperience}
          initialValues={socialValues}
          initialCertifications={student.certifications.map((c) => ({ name: c.name, url: c.url }))}
          stats={{
            courseCount: courses.length,
            totalHours,
            reviewCount: student._count.reviews,
            certificationCount: student.certifications.length,
          }}
          belowContent={belowContent}
        />
      </InstructorAccentProvider>
    </div>
  );
}
