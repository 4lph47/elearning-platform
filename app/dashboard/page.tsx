import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Flame, Trophy, Rocket, Award, BookMarked, Zap } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import { WeeklyActivityChart } from "@/components/dashboard/WeeklyActivityChart";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";

export const dynamic = "force-dynamic";

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
            modules: { include: { lessons: true }, orderBy: { order: "asc" } },
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

  const courseSummaries = enrollments.map(({ course }) => {
    const lessons = course.modules.flatMap((m) => m.lessons);
    const completedCount = lessons.filter((l) => progressByLesson.get(l.id)?.completed).length;
    const percent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

    const nextLesson = lessons.find((l) => !progressByLesson.get(l.id)?.completed) ?? lessons[0];

    return { course, lessons, completedCount, percent, nextLesson };
  });

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

  return (
    <div className="min-h-screen bg-white px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">A minha aprendizagem</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Acompanha o teu progresso e continua a aprender.</p>

        {courseSummaries.length > 0 && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
                      <div
                        className="h-1.5 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${xpIntoLevel}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Atividade dos últimos 7 dias
                </p>
                <WeeklyActivityChart data={weeklyActivity} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cursos por categoria
                </p>
                <CategoryBreakdown data={categoryData} />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
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
                    <a.icon
                      size={13}
                      className={a.unlocked ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-600"}
                    />{" "}
                    {a.label}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

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
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-neutral-900">
            {courseSummaries.map(({ course, lessons, completedCount, percent, nextLesson }, i) => (
              <div
                key={course.id}
                className={`flex items-center gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] ${
                  i > 0 ? "border-t border-slate-200 dark:border-white/10" : ""
                }`}
              >
                <ProgressRing percent={percent} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/courses/${course.slug}`}
                    prefetch
                    className="font-medium text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                  >
                    {course.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                      {course.category}
                    </span>
                    {percent === 100 && (
                      <span className="rounded-md bg-green-600/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
                        Concluído
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {completedCount} de {lessons.length} aulas concluídas
                  </p>
                </div>
                {nextLesson && (
                  <Link
                    href={`/courses/${course.slug}/lessons/${nextLesson.id}`}
                    prefetch
                    className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    {percent === 0 ? "Começar" : percent === 100 ? "Rever" : "Continuar"}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
