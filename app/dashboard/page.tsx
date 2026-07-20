import Link from "next/link";
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

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session!.user.id },
    include: {
      course: {
        include: {
          modules: { include: { lessons: true }, orderBy: { order: "asc" } },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const allProgress = await prisma.lessonProgress.findMany({
    where: { userId: session!.user.id },
  });
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

  return (
    <div className="min-h-screen bg-black px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-white">A minha aprendizagem</h1>
        <p className="mt-1 text-sm text-slate-400">Acompanha o teu progresso e continua a aprender.</p>

        {courseSummaries.length > 0 && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-slate-950 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600/15 text-blue-400">
                    <Zap size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-white">Nível {level}</span>
                      <span className="text-xs text-slate-500">{xpIntoLevel}/100 XP</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${xpIntoLevel}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
                    <Flame size={20} />
                  </span>
                  <div>
                    <div className="text-lg font-bold text-white">
                      {streak} dia{streak !== 1 ? "s" : ""}
                    </div>
                    <div className="text-xs text-slate-500">Sequência atual</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950 p-4">
                <div className="flex items-center justify-around text-center">
                  <div>
                    <div className="text-lg font-bold text-white">{courseSummaries.length}</div>
                    <div className="text-[11px] text-slate-500">Matriculados</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{inProgress}</div>
                    <div className="text-[11px] text-slate-500">Em progresso</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">{completed}</div>
                    <div className="text-[11px] text-slate-500">Concluídos</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-slate-950 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Atividade dos últimos 7 dias
                </p>
                <WeeklyActivityChart data={weeklyActivity} />
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cursos por categoria
                </p>
                <CategoryBreakdown data={categoryData} />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Conquistas</p>
              <div className="flex flex-wrap gap-2.5">
                {achievements.map((a) => (
                  <span
                    key={a.label}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                      a.unlocked
                        ? "border-blue-500/40 bg-blue-600/10 text-blue-300"
                        : "border-white/10 text-slate-600"
                    }`}
                  >
                    <a.icon size={13} /> {a.label}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {courseSummaries.length === 0 ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-slate-950 p-8 text-center">
            <p className="text-slate-400">
              Ainda não estás matriculado em nenhum curso.{" "}
              <Link href="/courses" className="font-medium text-blue-400 hover:underline">
                Explorar catálogo
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {courseSummaries.map(({ course, lessons, completedCount, percent, nextLesson }) => (
              <div
                key={course.id}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-slate-950 p-4 transition-colors hover:border-white/20"
              >
                <ProgressRing percent={percent} />
                <div className="min-w-0 flex-1">
                  <Link href={`/courses/${course.slug}`} className="font-medium text-white hover:text-blue-400">
                    {course.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-300">{course.category}</span>
                    {percent === 100 && (
                      <span className="rounded-full bg-green-600/15 px-2 py-0.5 font-medium text-green-400">
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
