import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { authOptions } from "@/lib/auth";
import { quizSchema } from "@/lib/validations";
import { getOwnedQuiz } from "@/lib/instructor-guard";
import { updateQuizById, deleteQuizById } from "@/lib/quiz";

export async function PATCH(request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { quizId } = await params;
  const quiz = await getOwnedQuiz(quizId, session);
  if (!quiz) return NextResponse.json({ error: "Quiz não encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = quizSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const result = await updateQuizById(quizId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  revalidateTag("courses");
  return NextResponse.json(result.quiz);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ quizId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { quizId } = await params;
  const quiz = await getOwnedQuiz(quizId, session);
  if (!quiz) return NextResponse.json({ error: "Quiz não encontrado" }, { status: 404 });

  await deleteQuizById(quizId);
  revalidateTag("courses");
  return NextResponse.json({ ok: true });
}
