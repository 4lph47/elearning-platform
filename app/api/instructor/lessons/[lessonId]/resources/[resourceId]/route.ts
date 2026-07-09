import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getOwnedLesson } from "@/lib/instructor-guard";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string; resourceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { lessonId, resourceId } = await params;
  const lesson = await getOwnedLesson(lessonId, session);
  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });

  const resource = await prisma.lessonResource.findUnique({ where: { id: resourceId } });
  if (!resource || resource.lessonId !== lessonId) {
    return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
  }

  await prisma.lessonResource.delete({ where: { id: resourceId } });
  await storage.delete(resource.url);

  return NextResponse.json({ ok: true });
}
