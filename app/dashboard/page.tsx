import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { Flame, Trophy, Rocket, Award, BookMarked, Zap } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DashboardTabs, type CourseStats } from "@/components/dashboard/DashboardTabs";
import type { CourseCardData } from "@/components/course/CourseCard";
import type { TransitionKind } from "@/components/course/CardTransitionContext";
import { WeeklyActivityChart } from "@/components/dashboard/WeeklyActivityChart";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";

export const dynamic = "force-dynamic";

interface EngagementRow {
  courseId: string;
  commentCount: bigint;
  likeCount: bigint;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/dashboard");

  const [enrollments, allProgress] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId: session.user.id },
      include: {
        course: {
          include: {
            instructor: { select: { name: true } },
            modules: { include: { lessons: true }, orderBy: { order: "asc" } },
            _count: { select: { enrollments: true } },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.lessonProgress.findMany({
      where: { userId: session.user.id },
    }),
  ]);
  const progressByLesson = new Map(allProgress.map((p) => [p.lessonId, p]));

  // Ordenado por última visita (não por data de matrícula): mesma lógica do
  // "Continuar onde paraste" da página principal — max entre a matrícula e o
  // progresso mais recente em qualquer aula do curso.
  const courseSummaries = enrollments
    .map((enrollment) => {
      const { course } = enrollment;
      const lessons = course.modules.flatMap((m) => m.lessons);
      const completedCount = lessons.filter((l) => progressByLesson.get(l.id)?.completed).length;
      const percent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

      const nextLesson = lessons.find((l) => !progressByLesson.get(l.id)?.completed) ?? lessons[0];
      const trailerLesson = lessons.find((l) => l.isFreePreview) ?? lessons[0];
      const lastActivity = Math.max(
        enrollment.enrolledAt.getTime(),
        ...lessons.map((l) => progressByLesson.get(l.id)?.updatedAt.getTime() ?? 0)
      );

      return { course, lessons, completedCount, percent, nextLesson, trailerLesson, lastActivity };
    })
    .sort((a, b) => b.lastActivity - a.lastActivity);

  const inProgress = courseSummaries.filter((c) => c.percent > 0 && c.percent < 100).length;
  const completed = courseSummaries.filter((c) => c.percent === 100).length;
  const totalCompletedLessons = allProgress.filter((p) => p.completed).length;

  // Gamificação: XP simples (10 por aula concluída), nível a cada 100 XP.
  const xp = totalCompletedLessons * 10;
  const level = Math.floor(xp / 100) + 1;
  const xpIntoLevel = xp % 100;

  // Sequência de dias com pelo menos uma aula concluída (streak).
  const completedDates = new Set(
    allProgress.filter((p) => p.completed && p.completedAt).map((p) => dateKey(p.completedAt!))
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!completedDates.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (completedDates.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Atividade dos últimos 7 dias (aulas concluídas por dia).
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - i));
    const count = allProgress.filter(
      (p) => p.completed && p.completedAt && dateKey(p.completedAt) === dateKey(date)
    ).length;
    return { date, count };
  });

  // Distribuição por categoria.
  const categoryCounts = new Map<string, number>();
  for (const { course } of courseSummaries) {
    categoryCounts.set(course.category, (categoryCounts.get(course.category) ?? 0) + 1);
  }
  const categoryData = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const achievements = [
    { label: "Primeiros passos", icon: Rocket, unlocked: totalCompletedLessons >= 1 },
    { label: "Maratonista (10 aulas)", icon: Trophy, unlocked: totalCompletedLessons >= 10 },
    { label: "Sequência em chamas", icon: Flame, unlocked: streak >= 3 },
    { label: "Colecionador (3 cursos)", icon: BookMarked, unlocked: enrollments.length >= 3 },
    { label: "Primeiro certificado", icon: Award, unlocked: completed >= 1 },
  ];

  const statTiles = [
    { label: "Nível", value: String(level), icon: Zap, hint: `${xpIntoLevel}/100 XP` },
    { label: "Sequência", value: `${streak} dia${streak !== 1 ? "s" : ""}`, icon: Flame, hint: "atual" },
    { label: "Matriculados", value: String(courseSummaries.length), icon: BookMarked, hint: "cursos" },
    { label: "Concluídos", value: String(completed), icon: Award, hint: `${inProgress} em progresso` },
  ];

  // Mesma forma que a página principal (CourseCardData) — cards e transição
  // (voo de vídeo/título via CourseTile/CourseRow) ficam literalmente iguais.
  const courses: CourseCardData[] = courseSummaries.map(({ course, lessons, trailerLesson }) => ({
    slug: course.slug,
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    thumbnailUrl: course.thumbnailUrl,
    instructorName: course.instructor.name,
    lessonCount: lessons.length,
    price: course.price,
    rating: course.rating,
    ratingCount: course.ratingCount,
    trailerUrl: course.trailerUrl ?? trailerLesson?.contentUrl ?? null,
  }));

  // Igual ao catálogo (app/courses/page.tsx) — comentários/likes só dão para
  // agregar com SQL próprio (Course->Module->Lesson->LessonComment->CommentLike).
  // Aqui corre sempre (não condicional como no catálogo) porque o conjunto é
  // pequeno (só os cursos em que o próprio utilizador está matriculado).
  const courseIds = courseSummaries.map(({ course }) => course.id);
  const engagementRows =
    courseIds.length > 0
      ? await prisma.$queryRaw<EngagementRow[]>`
          SELECT m."courseId" as "courseId",
                 COUNT(DISTINCT lc.id) as "commentCount",
                 COUNT(cl.id) as "likeCount"
          FROM "Module" m
          JOIN "Lesson" l ON l."moduleId" = m.id
          LEFT JOIN "LessonComment" lc ON lc."lessonId" = l.id
          LEFT JOIN "CommentLike" cl ON cl."commentId" = lc.id
          WHERE m."courseId" IN (${Prisma.join(courseIds)})
          GROUP BY m."courseId"
        `
      : [];
  const engagementByCourseId = new Map(
    engagementRows.map((r) => [r.courseId, { commentCount: Number(r.commentCount), likeCount: Number(r.likeCount) }])
  );

  const courseStatsBySlug: Record<string, CourseStats> = {};
  for (const { course, lessons } of courseSummaries) {
    const totalDurationSeconds = lessons.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
    const engagement = engagementByCourseId.get(course.id) ?? { commentCount: 0, likeCount: 0 };
    const favoriteScore =
      course.rating * 20 + course.ratingCount * 2 + engagement.commentCount * 3 + engagement.likeCount;
    courseStatsBySlug[course.slug] = {
      enrollmentCount: course._count.enrollments,
      totalDurationSeconds,
      commentCount: engagement.commentCount,
      likeCount: engagement.likeCount,
      favoriteScore,
      createdAt: course.createdAt.toISOString(),
    };
  }

  const hrefBySlug: Record<string, string> = {};
  const progressBySlug: Record<string, number> = {};
  const destinationKindBySlug: Record<string, TransitionKind> = {};
  const hidePriceBySlug: Record<string, boolean> = {};
  for (const { course, percent, nextLesson } of courseSummaries) {
    progressBySlug[course.slug] = percent;
    hidePriceBySlug[course.slug] = true;
    if (nextLesson) {
      hrefBySlug[course.slug] = `/courses/${course.slug}/lessons/${nextLesson.id}`;
      destinationKindBySlug[course.slug] = nextLesson.type === "VIDEO" ? "lesson-video" : "lesson-text";
    }
  }

  const activityContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statTiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tile.label}</p>
              <tile.icon size={15} className="text-slate-400 dark:text-slate-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{tile.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{tile.hint}</p>
            {tile.label === "Nível" && (
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/10">
                <div className="h-1.5 rounded-full bg-blue-500 transition-all" style={{ width: `${xpIntoLevel}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Atividade dos últimos 7 dias</p>
          <WeeklyActivityChart data={weeklyActivity} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Cursos por categoria</p>
          <CategoryBreakdown data={categoryData} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Conquistas</p>
        <div className="flex flex-wrap gap-2.5">
          {achievements.map((a) => (
            <span
              key={a.label}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                a.unlocked
                  ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
                  : "border-slate-100 text-slate-400 dark:border-white/5 dark:text-slate-600"
              }`}
            >
              <a.icon size={13} className={a.unlocked ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-600"} />{" "}
              {a.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">A minha aprendizagem</h1>
        <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">Acompanha o teu progresso e continua a aprender.</p>

        {courseSummaries.length === 0 ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-neutral-900">
            <p className="text-slate-500 dark:text-slate-400">
              Ainda não estás matriculado em nenhum curso.{" "}
              <Link href="/courses" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                Explorar catálogo
              </Link>
            </p>
          </div>
        ) : (
          <DashboardTabs
            activityContent={activityContent}
            courses={courses}
            hrefBySlug={hrefBySlug}
            progressBySlug={progressBySlug}
            destinationKindBySlug={destinationKindBySlug}
            hidePriceBySlug={hidePriceBySlug}
            courseStatsBySlug={courseStatsBySlug}
          />
        )}
      </div>
    </div>
  );
}
