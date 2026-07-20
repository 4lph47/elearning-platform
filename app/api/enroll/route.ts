import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });
  }

  const body = await request.json();
  const rawIds: unknown = Array.isArray(body.courseIds)
    ? body.courseIds
    : typeof body.courseId === "string"
      ? [body.courseId]
      : null;

  if (!Array.isArray(rawIds) || rawIds.length === 0 || !rawIds.every((id): id is string => typeof id === "string")) {
    return NextResponse.json({ error: "courseId em falta" }, { status: 400 });
  }
  const courseIds: string[] = rawIds;

  const courses = await prisma.course.findMany({ where: { id: { in: courseIds }, published: true } });
  if (courses.length !== courseIds.length) {
    return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });
  }

  const enrollments = await prisma.$transaction(
    courseIds.map((courseId: string) =>
      prisma.enrollment.upsert({
        where: { userId_courseId: { userId: session.user.id, courseId } },
        update: {},
        create: { userId: session.user.id, courseId },
      })
    )
  );

  await prisma.cartItem.deleteMany({ where: { userId: session.user.id, courseId: { in: courseIds } } });

  return NextResponse.json(enrollments, { status: 201 });
}
