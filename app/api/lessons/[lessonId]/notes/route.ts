import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Force dynamic rendering
export const dynamic = "force-dynamic";

const noteSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, "O conteúdo não pode estar vazio").max(50000),
});

// GET: Listar todas as notas do utilizador para TODAS as aulas deste curso
export async function GET(_request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { lessonId } = await params;

  // Buscar a aula para obter o curso
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });

  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });

  // Buscar todas as aulas deste curso
  const courseLessons = await prisma.lesson.findMany({
    where: { module: { courseId: lesson.module.courseId } },
    select: { id: true, title: true, module: { select: { title: true } } },
  });

  const lessonIds = courseLessons.map((l) => l.id);

  // Buscar todas as notas do utilizador para todas as aulas deste curso
  const notes = await prisma.lessonNote.findMany({
    where: { lessonId: { in: lessonIds }, userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      lessonId: true,
      lesson: { select: { title: true, module: { select: { title: true } } } },
    },
  });

  return NextResponse.json({ notes, currentLessonId: lessonId });
}

// POST: Criar uma nova nota
export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { lessonId } = await params;
  const body = await request.json();
  const parsed = noteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Se não foi fornecido título, gerar um a partir das primeiras palavras
  let title = parsed.data.title?.trim() || "";
  if (!title) {
    const words = parsed.data.content.trim().split(/\s+/).slice(0, 8);
    title = words.join(" ");
    if (parsed.data.content.trim().split(/\s+/).length > 8) {
      title += "...";
    }
  }

  const note = await prisma.lessonNote.create({
    data: {
      lessonId,
      userId: session.user.id,
      title,
      content: parsed.data.content.trim(),
    },
    include: {
      lesson: { select: { title: true, module: { select: { title: true } } } },
    },
  });

  return NextResponse.json(note, { status: 201 });
}
