import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FadeLink } from "@/components/course/FadeLink";
import { StudentAnalyticsCharts } from "@/components/student/StudentAnalyticsCharts";
import type { CourseMetric, HourPoint, LessonMetric, QuizScoreMetric, WeekPoint } from "@/components/instructor/AnalyticsCharts";

export const dynamic = "force-dynamic";

const WEEKS = 12;

function weekKey(d: Date) {
  const monday = new Date(d);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // recua até segunda-feira
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function avgScore(attempts: { scorePercent: number }[]) {
  if (attempts.length === 0) return null;
  return Math.round(attempts.reduce((s, a) => s + a.scorePercent, 0) / attempts.length);
}

// Versão do aluno de app/instructor/analytics/page.tsx — mesma estrutura de
// gráficos (AnalyticsCharts é o mesmo componente, só a navegação das barras
// muda, ver courseHref/lessonHref/quizHref abaixo), mas o universo de cursos
// não é "os que eu ensino": é "os cursos a que tenho acesso" — em que estou
// inscrito e/ou que estou a revender (ManageResaleSection). Um curso em que só
// estás inscrito entra com receita 0; um que também revendes soma o teu
// sellerCut (lib/resale.ts splitResalePrice) das vendas desse curso.
export default async function StudentAnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/dashboard/analytics");

  const userId = session.user.id;

  const [enrollmentCourseIds, listingCourseIds] = await Promise.all([
    prisma.enrollment.findMany({ where: { userId }, select: { courseId: true } }),
    prisma.resaleListing.findMany({ where: { sellerId: userId }, select: { courseId: true } }),
  ]);
  const courseIds = Array.from(
    new Set([...enrollmentCourseIds.map((e) => e.courseId), ...listingCourseIds.map((l) => l.courseId)])
  );

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    include: {
      enrollments: { select: { enrolledAt: true } },
      quiz: { include: { attempts: { select: { scorePercent: true } } } },
      modules: {
        include: {
          quizzes: { include: { attempts: { select: { scorePercent: true } } } },
          lessons: {
            select: {
              id: true,
              title: true,
              type: true,
              viewCount: true,
              moduleId: true,
              _count: { select: { reactions: { where: { type: "LIKE" } }, comments: true } },
              progress: { select: { watchedSeconds: true } },
              watchEvents: { select: { createdAt: true } },
              quiz: { include: { attempts: { select: { scorePercent: true } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const courseHrefById: Record<string, string> = {};
  for (const c of courses) courseHrefById[c.id] = `/courses/${c.slug}`;

  // Vendas de revenda em que TU és o vendedor (não a comissão do instrutor
  // original) — o teu ganho real como reseller, ver lib/resale.ts.
  const mySales = await prisma.resaleSale.findMany({
    where: { listing: { sellerId: userId, courseId: { in: courseIds } } },
    select: { createdAt: true, sellerCut: true, listing: { select: { courseId: true } } },
  });
  const resaleRevenueByCourseId = new Map<string, number>();
  for (const sale of mySales) {
    const id = sale.listing.courseId;
    resaleRevenueByCourseId.set(id, (resaleRevenueByCourseId.get(id) ?? 0) + sale.sellerCut);
  }
  const totalResaleRevenue = mySales.reduce((sum, s) => sum + s.sellerCut, 0);

  const totalEnrollments = courses.reduce((sum, c) => sum + c.enrollments.length, 0);
  const totalLessons = courses.reduce((sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.length, 0), 0);
  const totalViews = courses.reduce(
    (sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.reduce((ls, l) => ls + l.viewCount, 0), 0),
    0
  );
  const totalLikes = courses.reduce(
    (sum, c) =>
      sum + c.modules.reduce((s, m) => s + m.lessons.reduce((ls, l) => ls + l._count.reactions, 0), 0),
    0
  );
  const totalComments = courses.reduce(
    (sum, c) => sum + c.modules.reduce((s, m) => s + m.lessons.reduce((ls, l) => ls + l._count.comments, 0), 0),
    0
  );

  const now = new Date();
  const enrollmentBuckets = new Map<string, number>();
  const revenueBuckets = new Map<string, number>();
  for (let i = WEEKS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    enrollmentBuckets.set(weekKey(d), 0);
    revenueBuckets.set(weekKey(d), 0);
  }
  for (const course of courses) {
    for (const e of course.enrollments) {
      const key = weekKey(new Date(e.enrolledAt));
      if (enrollmentBuckets.has(key)) enrollmentBuckets.set(key, (enrollmentBuckets.get(key) ?? 0) + 1);
    }
  }
  for (const sale of mySales) {
    const key = weekKey(new Date(sale.createdAt));
    if (revenueBuckets.has(key)) revenueBuckets.set(key, (revenueBuckets.get(key) ?? 0) + sale.sellerCut);
  }
  const enrollmentsByWeek: WeekPoint[] = Array.from(enrollmentBuckets.entries()).map(([week, count]) => ({
    week: new Date(week).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
    count,
  }));
  const revenueByWeek: WeekPoint[] = Array.from(revenueBuckets.entries()).map(([week, count]) => ({
    week: new Date(week).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
    count: Math.round(count * 100) / 100,
  }));

  const courseStatus = {
    published: courses.filter((c) => c.published).length,
    draft: courses.filter((c) => !c.published).length,
  };
  const categoryCounts = new Map<string, number>();
  for (const c of courses) categoryCounts.set(c.category, (categoryCounts.get(c.category) ?? 0) + 1);
  const courseCategoryBreakdown = Array.from(categoryCounts.entries()).map(([category, value]) => ({
    name: category,
    value,
    category,
  }));

  const LEVEL_LABELS: Record<string, string> = {
    beginner: "Iniciante",
    intermediate: "Intermédio",
    advanced: "Avançado",
  };
  const levelCounts = new Map<string, number>();
  for (const c of courses) levelCounts.set(c.level, (levelCounts.get(c.level) ?? 0) + 1);
  const courseLevelBreakdown = Array.from(levelCounts.entries()).map(([level, value]) => ({
    name: LEVEL_LABELS[level] ?? level,
    value,
    level,
  }));

  const allLessonsFlat = courses.flatMap((c) => c.modules.flatMap((m) => m.lessons));
  const totalQuizzes = courses.reduce(
    (sum, c) =>
      sum +
      (c.quiz ? 1 : 0) +
      c.modules.reduce((s, m) => s + m.quizzes.length + m.lessons.filter((l) => l.quiz).length, 0),
    0
  );
  const lessonTypeBreakdown = [
    { type: "Vídeo", count: allLessonsFlat.filter((l) => l.type === "VIDEO").length },
    { type: "Texto", count: allLessonsFlat.filter((l) => l.type === "TEXT").length },
    { type: "Quiz", count: totalQuizzes },
  ];

  const quizScores: QuizScoreMetric[] = [];
  for (const c of courses) {
    if (c.quiz) {
      const score = avgScore(c.quiz.attempts);
      if (score !== null) {
        quizScores.push({
          id: c.quiz.id,
          title: c.quiz.title,
          courseTitle: c.title,
          avgScore: score,
          attempts: c.quiz.attempts.length,
          courseId: c.id,
          moduleId: null,
          lessonId: null,
        });
      }
    }
    for (const m of c.modules) {
      for (const q of m.quizzes) {
        const score = avgScore(q.attempts);
        if (score !== null) {
          quizScores.push({
            id: q.id,
            title: q.title,
            courseTitle: c.title,
            avgScore: score,
            attempts: q.attempts.length,
            courseId: c.id,
            moduleId: m.id,
            lessonId: null,
          });
        }
      }
      for (const l of m.lessons) {
        if (!l.quiz) continue;
        const score = avgScore(l.quiz.attempts);
        if (score !== null) {
          quizScores.push({
            id: l.quiz.id,
            title: l.quiz.title,
            courseTitle: c.title,
            avgScore: score,
            attempts: l.quiz.attempts.length,
            courseId: c.id,
            moduleId: m.id,
            lessonId: l.id,
          });
        }
      }
    }
  }
  quizScores.sort((a, b) => b.attempts - a.attempts);

  function avgWatchMinutes(progress: { watchedSeconds: number }[]) {
    if (progress.length === 0) return 0;
    return Math.round((progress.reduce((s, p) => s + p.watchedSeconds, 0) / progress.length / 60) * 10) / 10;
  }

  const hourBuckets = new Array(24).fill(0);
  for (const l of allLessonsFlat) {
    for (const ev of l.watchEvents) {
      hourBuckets[new Date(ev.createdAt).getHours()]++;
    }
  }
  const hourOfDay: HourPoint[] = hourBuckets.map((count, hour) => ({
    hour: `${String(hour).padStart(2, "0")}h`,
    count,
  }));

  const courseMetrics: CourseMetric[] = courses.map((c) => {
    const lessons = c.modules.flatMap((m) => m.lessons);
    const likes = lessons.reduce((s, l) => s + l._count.reactions, 0);
    const comments = lessons.reduce((s, l) => s + l._count.comments, 0);
    const allProgress = lessons.flatMap((l) => l.progress);
    return {
      id: c.id,
      title: c.title,
      enrollments: c.enrollments.length,
      revenue: resaleRevenueByCourseId.get(c.id) ?? 0,
      rating: c.rating,
      ratingCount: c.ratingCount,
      likes,
      comments,
      engagement: likes + comments,
      views: lessons.reduce((s, l) => s + l.viewCount, 0),
      avgWatchMinutes: avgWatchMinutes(allProgress),
    };
  });

  const lessonMetrics: LessonMetric[] = courses.flatMap((c) =>
    c.modules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        courseTitle: c.title,
        courseId: c.id,
        moduleId: m.id,
        views: l.viewCount,
        likes: l._count.reactions,
        comments: l._count.comments,
        avgWatchMinutes: avgWatchMinutes(l.progress),
      }))
    )
  );

  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-black sm:px-6">
      <div className="mx-auto max-w-[96rem]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
            <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
              Cursos em que estás inscrito e/ou a revender.
            </p>
          </div>
          <FadeLink
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            ← Voltar à minha aprendizagem
          </FadeLink>
        </div>

        {courses.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">Ainda não tens cursos para analisar.</p>
        ) : (
          <StudentAnalyticsCharts
            courseHrefById={courseHrefById}
            totals={{
              enrollments: totalEnrollments,
              revenue: totalResaleRevenue,
              resaleEarnings: 0,
              lessons: totalLessons,
              views: totalViews,
              likes: totalLikes,
              comments: totalComments,
              courses: courses.length,
            }}
            enrollmentsByWeek={enrollmentsByWeek}
            revenueByWeek={revenueByWeek}
            courseStatus={courseStatus}
            courseCategoryBreakdown={courseCategoryBreakdown}
            courseLevelBreakdown={courseLevelBreakdown}
            lessonTypeBreakdown={lessonTypeBreakdown}
            courseMetrics={courseMetrics}
            lessonMetrics={lessonMetrics}
            quizScores={quizScores}
            hourOfDay={hourOfDay}
          />
        )}
      </div>
    </div>
  );
}
