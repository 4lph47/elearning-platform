export interface SequenceLesson {
  id: string;
  title: string;
  isFreePreview: boolean;
  order: number;
  quizId: string | null;
}

export interface SequenceModuleQuiz {
  id: string;
  title: string;
  order: number;
}

export interface SequenceModule {
  lessons: SequenceLesson[];
  quizzes: SequenceModuleQuiz[];
  title: string;
}

export interface SequenceItem {
  type: "lesson" | "quiz";
  id: string;
  title: string;
  accessible: boolean;
}

// Achata módulos+aulas+quizzes (de aula, de módulo, final do curso) numa única
// sequência ordenada, para aulas e quizzes poderem navegar entre si (anterior/
// seguinte, swipe) como se fossem todos "aulas". Quizzes de módulo intercalam
// com as aulas pelo campo `order` (mesmo espaço de posições, ver
// app/api/instructor/modules/[moduleId]/reorder/route.ts) — quiz de aula
// (1:1) continua sempre logo a seguir à sua própria aula, independente disso.
export function buildCourseSequence(
  modules: SequenceModule[],
  courseQuiz: { id: string } | null,
  access: { isOwner: boolean; isEnrolled: boolean }
): SequenceItem[] {
  const items: SequenceItem[] = [];

  for (const m of modules) {
    type MergedEntry =
      | { kind: "lesson"; order: number; lesson: SequenceLesson }
      | { kind: "quiz"; order: number; quiz: SequenceModuleQuiz };
    const merged: MergedEntry[] = [
      ...m.lessons.map((l) => ({ kind: "lesson" as const, order: l.order, lesson: l })),
      ...m.quizzes.map((q) => ({ kind: "quiz" as const, order: q.order, quiz: q })),
    ];
    merged.sort((a, b) => a.order - b.order);

    for (const entry of merged) {
      if (entry.kind === "lesson") {
        const l = entry.lesson;
        const accessible = access.isOwner || access.isEnrolled || l.isFreePreview;
        items.push({ type: "lesson", id: l.id, title: l.title, accessible });
        if (l.quizId) {
          items.push({ type: "quiz", id: l.quizId, title: `Quiz · ${l.title}`, accessible });
        }
      } else {
        const q = entry.quiz;
        items.push({
          type: "quiz",
          id: q.id,
          title: `Quiz · ${q.title}`,
          accessible: access.isOwner || access.isEnrolled,
        });
      }
    }
  }

  if (courseQuiz) {
    items.push({
      type: "quiz",
      id: courseQuiz.id,
      title: "Exame final do curso",
      accessible: access.isOwner || access.isEnrolled,
    });
  }

  return items;
}

export function hrefFor(slug: string, item: SequenceItem) {
  return item.type === "lesson" ? `/courses/${slug}/lessons/${item.id}` : `/courses/${slug}/quiz/${item.id}`;
}
