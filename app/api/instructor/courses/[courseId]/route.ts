import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { courseSchema } from "@/lib/validations";
import { getOwnedCourse } from "@/lib/instructor-guard";

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, session);
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = courseSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updated = await prisma.course.update({
    where: { id: courseId },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, session);
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  await prisma.course.delete({ where: { id: courseId } });
  return NextResponse.json({ ok: true });
}
