import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOwnedQuiz } from "@/lib/instructor-guard";
import { ModuleQuizForm } from "@/components/instructor/ModuleQuizForm";

export const dynamic = "force-dynamic";

export default async function EditModuleQuizPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string; quizId: string }>;
}) {
  const { courseId, moduleId, quizId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const quiz = await getOwnedQuiz(quizId, session);
  if (!quiz || quiz.moduleId !== moduleId || quiz.module?.courseId !== courseId) notFound();

  const questions = await prisma.quizQuestion.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return (
    <ModuleQuizForm
      courseId={courseId}
      moduleId={moduleId}
      quiz={{
        id: quiz.id,
        title: quiz.title,
        timeLimitMinutes: quiz.timeLimitMinutes,
        questions,
      }}
    />
  );
}
