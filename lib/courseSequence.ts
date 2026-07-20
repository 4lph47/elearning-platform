export interface SequenceLesson {
  id: string;
  title: string;
  isFreePreview: boolean;
  quizId: string | null;
}

export interface SequenceModule {
  lessons: SequenceLesson[];
  quizId: string | null;
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
// seguinte, swipe) como se fossem todos "aulas".
export function buildCourseSequence(
  modules: SequenceModule[],
  courseQuiz: { id: string } | null,
  access: { isOwner: boolean; isEnrolled: boolean }
): SequenceItem[] {
  const items: SequenceItem[] = [];

  for (const m of modules) {
    for (const l of m.lessons) {
      const accessible = access.isOwner || access.isEnrolled || l.isFreePreview;
      items.push({ type: "lesson", id: l.id, title: l.title, accessible });
      if (l.quizId) {
        items.push({ type: "quiz", id: l.quizId, title: `Quiz · ${l.title}`, accessible });
      }
    }
    if (m.quizId) {
      items.push({
        type: "quiz",
        id: m.quizId,
        title: `Quiz · ${m.title}`,
        accessible: access.isOwner || access.isEnrolled,
      });
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
