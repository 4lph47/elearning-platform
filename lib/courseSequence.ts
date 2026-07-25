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
// Quizzes só ficam acessíveis depois de todas as aulas anteriores concluídas
// (quiz de aula: essa aula; quiz de módulo: aulas do módulo com order menor;
// exame final: todas as aulas do curso). Dono do curso ignora este bloqueio.
export function buildCourseSequence(
  modules: SequenceModule[],
  courseQuiz: { id: string } | null,
  access: { isOwner: boolean; isEnrolled: boolean },
  progressByLessonId: Record<string, boolean> = {}
): SequenceItem[] {
  const items: SequenceItem[] = [];
  let allPriorLessonsDone = true;

  for (const m of modules) {
    type MergedEntry =
      | { kind: "lesson"; order: number; lesson: SequenceLesson }
      | { kind: "quiz"; order: number; quiz: SequenceModuleQuiz };
    const merged: MergedEntry[] = [
      ...m.lessons.map((l) => ({ kind: "lesson" as const, order: l.order, lesson: l })),
      ...m.quizzes.map((q) => ({ kind: "quiz" as const, order: q.order, quiz: q })),
    ];
    merged.sort((a, b) => a.order - b.order);

    let moduleLessonsDoneSoFar = true;
    for (const entry of merged) {
      if (entry.kind === "lesson") {
        const l = entry.lesson;
        const accessible = access.isOwner || access.isEnrolled || l.isFreePreview;
        items.push({ type: "lesson", id: l.id, title: l.title, accessible });
        if (l.quizId) {
          const lessonDone = Boolean(progressByLessonId[l.id]);
          items.push({
            type: "quiz",
            id: l.quizId,
            title: `Quiz · ${l.title}`,
            accessible: accessible && (access.isOwner || lessonDone),
          });
        }
        if (!progressByLessonId[l.id]) {
          moduleLessonsDoneSoFar = false;
          allPriorLessonsDone = false;
        }
      } else {
        const q = entry.quiz;
        const baseAccessible = access.isOwner || access.isEnrolled;
        items.push({
          type: "quiz",
          id: q.id,
          title: `Quiz · ${q.title}`,
          accessible: baseAccessible && (access.isOwner || moduleLessonsDoneSoFar),
        });
      }
    }
  }

  if (courseQuiz) {
    const baseAccessible = access.isOwner || access.isEnrolled;
    items.push({
      type: "quiz",
      id: courseQuiz.id,
      title: "Exame final do curso",
      accessible: baseAccessible && (access.isOwner || allPriorLessonsDone),
    });
  }

  return items;
}

export function hrefFor(slug: string, item: SequenceItem) {
  return item.type === "lesson" ? `/courses/${slug}/lessons/${item.id}` : `/courses/${slug}/quiz/${item.id}`;
}
