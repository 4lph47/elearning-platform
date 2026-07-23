import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOwnedModule } from "@/lib/instructor-guard";
import { syncCourseThumbnail } from "@/lib/courseThumbnail";

const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string().min(1), kind: z.enum(["lesson", "quiz"]) })).min(1),
});

// Aulas e quizzes de um módulo partilham o mesmo espaço de posições — a
// lista completa e ordenada (arrastada pelo instrutor) chega aqui de uma vez
// só, e o índice de cada item vira o seu novo `order`.
export async function PATCH(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { moduleId } = await params;
  const courseModule = await getOwnedModule(moduleId, session);
  if (!courseModule) return NextResponse.json({ error: "Módulo não encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.items.map((item, order) =>
      item.kind === "lesson"
        ? prisma.lesson.update({ where: { id: item.id, moduleId }, data: { order } })
        : prisma.quiz.update({ where: { id: item.id, moduleId }, data: { order } })
    )
  );

  // Reordenar pode mudar qual é a primeira aula do módulo — recalcula
  // sempre, é barato e evita depender de sabermos se é o 1º módulo.
  await syncCourseThumbnail(courseModule.course.id);

  revalidateTag("courses");
  return NextResponse.json({ ok: true });
}
