import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });
  }

  const { courseId } = await request.json();
  if (typeof courseId !== "string") {
    return NextResponse.json({ error: "courseId em falta" }, { status: 400 });
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !course.published) {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });
  }

  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    update: {},
    create: { userId: session.user.id, courseId },
  });

  return NextResponse.json(enrollment, { status: 201 });
}
