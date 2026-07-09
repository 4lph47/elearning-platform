import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { quizId } = await params;
  const body = await request.json();
  const answers = body.answers as Record<string, string> | undefined;
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { include: { options: true }, orderBy: { order: "asc" } },
      lesson: { include: { module: { include: { course: true } } } },
      module: { include: { course: true } },
      course: true,
    },
  });
  if (!quiz) return NextResponse.json({ error: "Quiz não encontrado" }, { status: 404 });

  const course = quiz.lesson?.module.course ?? quiz.module?.course ?? quiz.course;
  if (!course) return NextResponse.json({ error: "Quiz não encontrado" }, { status: 404 });

  const isOwner = course.instructorId === session.user.id;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });
  const isEnrolled = Boolean(enrollment);
  const hasAccess =
    isOwner || isEnrolled || (quiz.scope === "LESSON" && quiz.lesson?.isFreePreview === true);

  if (!hasAccess) return NextResponse.json({ error: "Sem acesso a este quiz" }, { status: 403 });

  if (quiz.maxAttempts !== null) {
    const attemptsUsed = await prisma.quizAttempt.count({
      where: { quizId: quiz.id, userId: session.user.id },
    });
    if (attemptsUsed >= quiz.maxAttempts) {
      return NextResponse.json({ error: "Limite de tentativas atingido para este quiz" }, { status: 403 });
    }
  }

  let correctCount = 0;
  const correctOptionByQuestion: Record<string, string> = {};
  for (const question of quiz.questions) {
    const correctOption = question.options.find((o) => o.isCorrect);
    correctOptionByQuestion[question.id] = correctOption?.id ?? "";
    if (correctOption && answers[question.id] === correctOption.id) {
      correctCount += 1;
    }
  }
  const scorePercent =
    quiz.questions.length > 0 ? Math.round((correctCount / quiz.questions.length) * 100) : 0;

  await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      userId: session.user.id,
      scorePercent,
      answers,
    },
  });

  return NextResponse.json({ scorePercent, correctOptionByQuestion });
}
