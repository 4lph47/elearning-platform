import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quizSchema } from "@/lib/validations";
import { getOwnedModule } from "@/lib/instructor-guard";
import { createModuleQuiz } from "@/lib/quiz";

export async function POST(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { moduleId } = await params;
  const courseModule = await getOwnedModule(moduleId, session);
  if (!courseModule) return NextResponse.json({ error: "Módulo não encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = quizSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Posição no fim da lista combinada (aulas + quizzes) deste módulo — a
  // reordenação por drag-and-drop é quem move o quiz para outra posição.
  const [lessonCount, quizCount] = await Promise.all([
    prisma.lesson.count({ where: { moduleId } }),
    prisma.quiz.count({ where: { moduleId } }),
  ]);

  const result = await createModuleQuiz(moduleId, lessonCount + quizCount, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  revalidateTag("courses");
  return NextResponse.json(result.quiz, { status: 201 });
}
