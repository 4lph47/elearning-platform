import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { CheckCircle2, Video, ListChecks, Paperclip, Infinity as InfinityIcon, HelpCircle, Lock, Star, Users, BookOpen, Smartphone, Award, MessageSquare } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCachedCourseBySlug, getCachedRelatedCourses } from "@/lib/courseCache";
import { EnrollButton } from "@/components/course/EnrollButton";
import { AddToCartButton } from "@/components/course/AddToCartButton";
import { CourseDetailTabs } from "@/components/course/CourseDetailTabs";
import { CourseHero } from "@/components/course/CourseHero";
import { CourseRow } from "@/components/course/CourseRow";
import { FrequentlyBoughtTogether } from "@/components/course/FrequentlyBoughtTogether";
import type { CourseCardData } from "@/components/course/CourseCard";

export const dynamic = "force-dynamic";

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}min`;
}

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getServerSession(authOptions);

  const course = await getCachedCourseBySlug(slug);

  if (!course || (!course.published && course.instructorId !== session?.user.id)) {
    notFound();
  }

  const authors = [course.instructor, ...course.collaborators];
  const isOwner =
    session?.user.id === course.instructorId || course.collaborators.some((c) => c.id === session?.user.id);
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const firstLesson = allLessons[0];
  const totalDuration = allLessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
  const totalResources = allLessons.reduce((sum, l) => sum + l._count.resources, 0);
  const moduleQuizIds = course.modules.map((m) => m.quiz?.id).filter((id): id is string => Boolean(id));
  const lessonQuizIds = allLessons.map((l) => l.quiz?.id).filter((id): id is string => Boolean(id));
  const allQuizIds = [...moduleQuizIds, ...lessonQuizIds, ...(course.quiz ? [course.quiz.id] : [])];

  const bundleCourses = (course.bundle?.courses ?? []).filter((c) => c.id !== course.id);

  const [
    enrollment,
    doneLessons,
    doneQuizzes,
    { relatedCourses, instructorCourses, instructorOtherCourses, recommendedCourses },
    bundleEnrollments,
  ] = await Promise.all([
    session
      ? prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
        })
      : Promise.resolve(null),
    session
      ? prisma.lessonProgress.count({
          where: { userId: session.user.id, lessonId: { in: allLessons.map((l) => l.id) }, completed: true },
        })
      : Promise.resolve(0),
    session && allQuizIds.length
      ? prisma.quizAttempt.findMany({
          where: { quizId: { in: allQuizIds }, userId: session.user.id },
          select: { quizId: true },
          distinct: ["quizId"],
        })
      : Promise.resolve([]),
    getCachedRelatedCourses(course.id, course.category, course.instructorId),
    session && bundleCourses.length > 0
      ? prisma.enrollment.findMany({
          where: { userId: session.user.id, courseId: { in: bundleCourses.map((c) => c.id) } },
          select: { courseId: true },
        })
      : Promise.resolve([]),
  ]);

  const sideRailCourseIds = [...relatedCourses, ...instructorOtherCourses, ...recommendedCourses].map((c) => c.id);
  const sideRailEnrollments = session && sideRailCourseIds.length > 0
    ? await prisma.enrollment.findMany({
        where: { userId: session.user.id, courseId: { in: sideRailCourseIds } },
        select: { courseId: true },
      })
    : [];
  const sideRailEnrolledIds = new Set(sideRailEnrollments.map((e) => e.courseId));

  const isEnrolled = Boolean(enrollment);

  let completion: { percent: number; completedCount: number; totalItems: number } | null = null;
  if (isEnrolled) {
    const totalItems = allLessons.length + allQuizIds.length;
    const completedCount = doneLessons + doneQuizzes.length;
    completion = {
      percent: totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0,
      completedCount,
      totalItems,
    };
  }

  const myReview = session ? course.reviews.find((r) => r.userId === session.user.id) ?? null : null;
  const trailerLesson = allLessons.find((l) => l.isFreePreview) ?? firstLesson;
  const heroVideoUrl = course.trailerUrl ?? trailerLesson?.contentUrl ?? null;

  const instructorRatedCourses = instructorCourses.filter((c) => c.ratingCount > 0);
  const instructorAvgRating =
    instructorRatedCourses.length > 0
      ? instructorRatedCourses.reduce((sum, c) => sum + c.rating * c.ratingCount, 0) /
        instructorRatedCourses.reduce((sum, c) => sum + c.ratingCount, 0)
      : null;
  const instructorStudents = instructorCourses.reduce((sum, c) => sum + c._count.enrollments, 0);
  const instructorReviews = instructorCourses.reduce((sum, c) => sum + c.ratingCount, 0);

  const bundleEnrolledIds = new Set(bundleEnrollments.map((e) => e.courseId));
  const bundleExtras = isEnrolled
    ? []
    : bundleCourses
        .filter((c) => !bundleEnrolledIds.has(c.id))
        .map((c) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          thumbnailUrl: c.thumbnailUrl,
          price: c.price,
          instructorName: c.instructor.name,
        }));

  const alsoBought: CourseCardData[] = relatedCourses
    .filter((c) => !bundleExtras.some((b) => b.id === c.id))
    .map((c) => {
    const lessons = c.modules.flatMap((m) => m.lessons);
    return {
      slug: c.slug,
      title: c.title,
      description: c.description,
      category: c.category,
      level: c.level,
      thumbnailUrl: c.thumbnailUrl,
      instructorName: c.instructor.name,
      lessonCount: c.modules.reduce((sum, m) => sum + m._count.lessons, 0),
      price: c.price,
      rating: c.rating,
      ratingCount: c.ratingCount,
      trailerUrl: c.trailerUrl ?? (lessons.find((l) => l.isFreePreview) ?? lessons[0])?.contentUrl ?? null,
    };
  });

  const moreFromInstructor: CourseCardData[] = instructorOtherCourses.map((c) => {
    const lessons = c.modules.flatMap((m) => m.lessons);
    return {
      slug: c.slug,
      title: c.title,
      description: c.description,
      category: c.category,
      level: c.level,
      thumbnailUrl: c.thumbnailUrl,
      instructorName: c.instructor.name,
      lessonCount: c.modules.reduce((sum, m) => sum + m._count.lessons, 0),
      price: c.price,
      rating: c.rating,
      ratingCount: c.ratingCount,
      trailerUrl: c.trailerUrl ?? (lessons.find((l) => l.isFreePreview) ?? lessons[0])?.contentUrl ?? null,
    };
  });

  const recommended: CourseCardData[] = recommendedCourses.map((c) => {
    const lessons = c.modules.flatMap((m) => m.lessons);
    return {
      slug: c.slug,
      title: c.title,
      description: c.description,
      category: c.category,
      level: c.level,
      thumbnailUrl: c.thumbnailUrl,
      instructorName: c.instructor.name,
      lessonCount: c.modules.reduce((sum, m) => sum + m._count.lessons, 0),
      price: c.price,
      rating: c.rating,
      ratingCount: c.ratingCount,
      trailerUrl: c.trailerUrl ?? (lessons.find((l) => l.isFreePreview) ?? lessons[0])?.contentUrl ?? null,
    };
  });

  const hidePriceBySlug = Object.fromEntries(
    [...relatedCourses, ...instructorOtherCourses, ...recommendedCourses]
      .filter((c) => sideRailEnrolledIds.has(c.id))
      .map((c) => [c.slug, true])
  );

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <CourseHero
        title={course.title}
        description={course.description}
        category={course.category}
        isDraft={!course.published}
        rating={course.rating}
        ratingCount={course.ratingCount}
        enrollmentsCount={course._count.enrollments}
        instructorId={course.instructor.id}
        instructorName={course.instructor.name}
        videoUrl={heroVideoUrl}
        thumbnailUrl={course.thumbnailUrl}
      />

      <div className="mx-auto max-w-7xl px-3 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {course.learningOutcomes.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-5 dark:border-white/10">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                  O que vais aprender
                </p>
                <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                  {course.learningOutcomes.map((outcome, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      {outcome}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {course.topics.length > 0 && (
              <div>
                <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Explorar tópicos relacionados</h2>
                <div className="flex flex-wrap gap-2">
                  {course.topics.map((topic) => (
                    <Link
                      key={topic}
                      href={`/courses?q=${encodeURIComponent(topic)}`}
                      className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:border-blue-500/60 hover:text-slate-900 dark:border-white/15 dark:text-slate-300 dark:hover:text-white"
                    >
                      {topic}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {course.requirements.length > 0 && (
              <div>
                <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Requisitos</h2>
                <ul className="space-y-1.5">
                  {course.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Descrição</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">{course.description}</p>
            </div>

            {course.targetAudience.length > 0 && (
              <div>
                <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">Para quem é este curso</h2>
                <ul className="space-y-1.5">
                  {course.targetAudience.map((aud, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
                      {aud}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <CourseDetailTabs
              courseId={course.id}
              courseSlug={course.slug}
              courseTitle={course.title}
              modules={course.modules}
              isEnrolled={isEnrolled}
              isOwner={isOwner}
              reviews={course.reviews.map((r) => ({
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                createdAt: new Date(r.createdAt).toISOString(),
                userName: r.user.name,
              }))}
              myReview={myReview ? { rating: myReview.rating, comment: myReview.comment } : null}
              completion={completion}
              studentName={session?.user.name ?? null}
            />
          </div>

          <div className="sticky top-20 space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 dark:border-white/10 dark:bg-slate-950 dark:shadow-black/40">
              {course.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.thumbnailUrl} alt={course.title} className="h-40 w-full object-cover" />
              )}

              <div className="p-4">
                <h2 className="mb-3 line-clamp-2 font-semibold text-slate-900 dark:text-white">{course.title}</h2>
                {isOwner ? (
                  <Link href={`/instructor/courses/${course.id}`}>
                    <p className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
                      Editar este curso
                    </p>
                  </Link>
                ) : isEnrolled ? (
                  <Link href={firstLesson ? `/courses/${course.slug}/lessons/${firstLesson.id}` : "#"}>
                    <p className="rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-500">
                      Continuar curso
                    </p>
                  </Link>
                ) : (
                  <>
                    <EnrollButton
                      courseId={course.id}
                      courseSlug={course.slug}
                      price={course.price}
                      isAuthenticated={Boolean(session)}
                      firstLessonHref={firstLesson ? `/courses/${course.slug}/lessons/${firstLesson.id}` : "#"}
                    />
                    <AddToCartButton courseId={course.id} isAuthenticated={Boolean(session)} />
                  </>
                )}

                {!isOwner && !isEnrolled && (
                <div className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400">
                  {course.price === 0 ? (
                    "Grátis"
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{course.price.toFixed(2)}€</span>
                        {course.originalPrice != null && course.originalPrice > course.price && (
                          <span className="text-sm text-slate-400 line-through dark:text-slate-500">
                            {course.originalPrice.toFixed(2)}€
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-center gap-1.5">
                        {course.originalPrice != null && course.originalPrice > course.price && (
                          <>
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              {Math.round((1 - course.price / course.originalPrice) * 100)}% de desconto
                            </span>
                            <span className="text-slate-400 dark:text-slate-600">·</span>
                          </>
                        )}
                        <span>pagamento único</span>
                      </div>
                    </>
                  )}
                </div>
                )}
              </div>

              <div className="border-t border-slate-200 p-4 dark:border-white/10">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Este curso inclui
                </p>
                <dl className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2.5">
                    <Video size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>{formatDuration(totalDuration)} de vídeo sob demanda</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <ListChecks size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>{allLessons.length} aulas</span>
                  </div>
                  {totalResources > 0 && (
                    <div className="flex items-center gap-2.5">
                      <Paperclip size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>{totalResources} materiais de apoio para download</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5">
                    <InfinityIcon size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>Acesso vitalício</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Smartphone size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>Acesso em qualquer dispositivo</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Award size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>Certificado de conclusão</span>
                  </div>
                </dl>
              </div>

              {course.quiz && (
                <div className="border-t border-slate-200 p-4 dark:border-white/10">
                  {isEnrolled || isOwner ? (
                    <Link
                      href={`/courses/${course.slug}/quiz/${course.quiz.id}`}
                      className="flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      <HelpCircle size={16} />
                      Fazer teste final do curso
                    </Link>
                  ) : (
                    <p className="flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-center text-sm text-slate-500 dark:border-white/10">
                      <Lock size={14} />
                      Teste final do curso (inscreve-te para aceder)
                    </p>
                  )}
                </div>
              )}
            </div>

            {bundleExtras.length > 0 && (
              <FrequentlyBoughtTogether
                name={course.bundle!.name}
                primary={{
                  id: course.id,
                  slug: course.slug,
                  title: course.title,
                  thumbnailUrl: course.thumbnailUrl,
                  price: course.price,
                  instructorName: course.instructor.name,
                }}
                extras={bundleExtras}
                isAuthenticated={Boolean(session)}
              />
            )}
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-8 dark:border-white/10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{authors.length > 1 ? "Instrutores" : "Instrutor"}</h2>
          <div className="space-y-4">
            {authors.map((author) => (
              <Link
                key={author.id}
                href={`/instructors/${author.id}`}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-white/10 dark:bg-slate-950 dark:hover:border-white/20 sm:flex-row sm:items-start"
              >
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
                  {author.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("")}
                </span>
                <div>
                  <p className="font-semibold text-blue-600 hover:underline dark:text-blue-400">{author.name}</p>
                  {author.id === course.instructor.id && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                      {instructorAvgRating !== null && (
                        <span className="flex items-center gap-1.5">
                          <Star size={14} className="fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400" /> {instructorAvgRating.toFixed(1)} média
                        </span>
                      )}
                      {instructorReviews > 0 && (
                        <span className="flex items-center gap-1.5">
                          <MessageSquare size={14} /> {instructorReviews} avaliaç{instructorReviews !== 1 ? "ões" : "ão"}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Users size={14} /> {instructorStudents} aluno{instructorStudents !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <BookOpen size={14} /> {instructorCourses.length} curso{instructorCourses.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                  {author.bio && <p className="mt-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{author.bio}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl">
        {moreFromInstructor.length > 0 && (
          <CourseRow
            title={`Mais cursos de ${course.instructor.name}`}
            courses={moreFromInstructor}
            hidePriceBySlug={hidePriceBySlug}
          />
        )}
        {recommended.length > 0 && (
          <CourseRow title="Também pode interessar-te" courses={recommended} hidePriceBySlug={hidePriceBySlug} />
        )}
        {alsoBought.length > 0 && (
          <CourseRow title="Os alunos também compraram" courses={alsoBought} hidePriceBySlug={hidePriceBySlug} />
        )}
      </div>
    </div>
  );
}
