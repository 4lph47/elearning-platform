"use client";

import {
  AnalyticsCharts,
  type CourseMetric,
  type HourPoint,
  type LessonMetric,
  type QuizScoreMetric,
  type WeekPoint,
  type Totals,
} from "@/components/instructor/AnalyticsCharts";

// Funções não podem atravessar a fronteira servidor->cliente do Next (RSC) —
// era exatamente isso que rebentava esta página: app/dashboard/analytics
// (Server Component) passava courseHref/lessonHref/quizHref como funções
// diretamente para o AnalyticsCharts (Client Component). Este wrapper, ele
// próprio já client, recebe só o mapa (dados simples, serializáveis) e
// constrói as funções aqui dentro, nunca cruzando a fronteira.
export function StudentAnalyticsCharts({
  courseHrefById,
  totals,
  enrollmentsByWeek,
  revenueByWeek,
  courseStatus,
  courseCategoryBreakdown,
  courseLevelBreakdown,
  lessonTypeBreakdown,
  courseMetrics,
  lessonMetrics,
  quizScores,
  hourOfDay,
}: {
  courseHrefById: Record<string, string>;
  totals: Totals;
  enrollmentsByWeek: WeekPoint[];
  revenueByWeek: WeekPoint[];
  courseStatus: { published: number; draft: number };
  courseCategoryBreakdown: { name: string; value: number; category: string }[];
  courseLevelBreakdown: { name: string; value: number; level: string }[];
  lessonTypeBreakdown: { type: string; count: number }[];
  courseMetrics: CourseMetric[];
  lessonMetrics: LessonMetric[];
  quizScores: QuizScoreMetric[];
  hourOfDay: HourPoint[];
}) {
  return (
    <AnalyticsCharts
      totals={totals}
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
      courseHref={(courseId) => courseHrefById[courseId] ?? "/dashboard"}
      lessonHref={(courseId, _moduleId, lessonId) =>
        courseHrefById[courseId] ? `${courseHrefById[courseId]}/lessons/${lessonId}` : "/dashboard"
      }
      quizHref={(q) => (courseHrefById[q.courseId] ? `${courseHrefById[q.courseId]}/quiz/${q.id}` : "/dashboard")}
      courseStatusHref="/dashboard"
    />
  );
}
