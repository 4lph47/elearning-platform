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
  // Usa o maior `order` existente + 1 (não a contagem): aulas/quizzes
  // apagados deixam buracos e a contagem colidiria com um order já em uso.
  const [maxLessonOrder, maxQuizOrder] = await Promise.all([
    prisma.lesson.aggregate({ where: { moduleId }, _max: { order: true } }),
    prisma.quiz.aggregate({ where: { moduleId }, _max: { order: true } }),
  ]);
  const nextOrder = Math.max(maxLessonOrder._max.order ?? -1, maxQuizOrder._max.order ?? -1) + 1;

  const result = await createModuleQuiz(moduleId, nextOrder, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  revalidateTag("courses");
  return NextResponse.json(result.quiz, { status: 201 });
}
