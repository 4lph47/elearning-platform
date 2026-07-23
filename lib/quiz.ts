import { prisma } from "@/lib/db";
import type { QuizInput } from "@/lib/validations";

export type QuizScope = "LESSON" | "MODULE" | "COURSE";

function validateQuestions(questions: QuizInput["questions"]) {
  for (const q of questions) {
    const correctCount = q.options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      return `A pergunta "${q.text}" precisa de exatamente 1 opção correta`;
    }
  }
  return null;
}

function questionsCreateData(questions: QuizInput["questions"]) {
  return questions.map((q) => ({
    text: q.text,
    order: q.order,
    options: {
      create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect ?? false, order: o.order })),
    },
  }));
}

const includeQuestions = {
  questions: {
    include: { options: { orderBy: { order: "asc" as const } } },
    orderBy: { order: "asc" as const },
  },
};

// LESSON/COURSE continuam 1:1 (upsert por parentId) — só MODULE deixou de o
// ser (ver createModuleQuiz/updateQuizById/deleteQuizById abaixo).
export async function upsertQuiz(scope: "LESSON" | "COURSE", parentId: string, data: QuizInput) {
  const error = validateQuestions(data.questions);
  if (error) return { ok: false as const, error };

  const questions = questionsCreateData(data.questions);
  const shared = {
    title: data.title,
    // Só o quiz final do curso pode limitar tentativas — quizzes de aula/módulo são sempre ilimitados.
    maxAttempts: scope === "COURSE" ? data.maxAttempts ?? null : null,
    timeLimitMinutes: data.timeLimitMinutes ?? null,
  };

  if (scope === "LESSON") {
    const quiz = await prisma.quiz.upsert({
      where: { lessonId: parentId },
      update: { ...shared, questions: { deleteMany: {}, create: questions } },
      create: { scope, ...shared, lessonId: parentId, questions: { create: questions } },
      include: includeQuestions,
    });
    return { ok: true as const, quiz };
  }

  const quiz = await prisma.quiz.upsert({
    where: { courseId: parentId },
    update: { ...shared, questions: { deleteMany: {}, create: questions } },
    create: { scope, ...shared, courseId: parentId, questions: { create: questions } },
    include: includeQuestions,
  });
  return { ok: true as const, quiz };
}

export async function deleteQuiz(scope: "LESSON" | "COURSE", parentId: string) {
  if (scope === "LESSON") {
    await prisma.quiz.deleteMany({ where: { lessonId: parentId } });
  } else {
    await prisma.quiz.deleteMany({ where: { courseId: parentId } });
  }
}

// Quiz de módulo: vários por módulo, cada um na sua posição (`order`),
// intercalado com as aulas — por isso create (nunca upsert-por-moduleId) e
// update/delete por id próprio (não há "o" quiz do módulo, há vários).
export async function createModuleQuiz(moduleId: string, order: number, data: QuizInput) {
  const error = validateQuestions(data.questions);
  if (error) return { ok: false as const, error };

  const quiz = await prisma.quiz.create({
    data: {
      scope: "MODULE",
      title: data.title,
      maxAttempts: null,
      timeLimitMinutes: data.timeLimitMinutes ?? null,
      order,
      moduleId,
      questions: { create: questionsCreateData(data.questions) },
    },
    include: includeQuestions,
  });
  return { ok: true as const, quiz };
}

export async function updateQuizById(quizId: string, data: QuizInput) {
  const error = validateQuestions(data.questions);
  if (error) return { ok: false as const, error };

  const quiz = await prisma.quiz.update({
    where: { id: quizId },
    data: {
      title: data.title,
      timeLimitMinutes: data.timeLimitMinutes ?? null,
      questions: { deleteMany: {}, create: questionsCreateData(data.questions) },
    },
    include: includeQuestions,
  });
  return { ok: true as const, quiz };
}

export async function deleteQuizById(quizId: string) {
  await prisma.quiz.delete({ where: { id: quizId } });
}
