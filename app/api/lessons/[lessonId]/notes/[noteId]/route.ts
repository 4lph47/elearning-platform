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

// PATCH: Atualizar uma nota existente
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ lessonId: string; noteId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { noteId } = await params;
  const body = await request.json();
  const parsed = noteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const existing = await prisma.lessonNote.findUnique({ where: { id: noteId } });
  if (!existing) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Não tens permissão para editar esta nota" }, { status: 403 });
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

  const note = await prisma.lessonNote.update({
    where: { id: noteId },
    data: { title, content: parsed.data.content.trim() },
  });

  return NextResponse.json(note);
}

// DELETE: Remover uma nota
export async function DELETE(_request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { noteId } = await params;

  const existing = await prisma.lessonNote.findUnique({ where: { id: noteId } });
  if (!existing) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Não tens permissão para remover esta nota" }, { status: 403 });
  }

  await prisma.lessonNote.delete({ where: { id: noteId } });

  return NextResponse.json({ ok: true });
}
