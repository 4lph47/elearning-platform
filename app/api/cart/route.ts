import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const items = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    select: { courseId: true },
  });
  return NextResponse.json({ count: items.length, courseIds: items.map((i) => i.courseId) });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!dbUser) {
    return NextResponse.json({ error: "Sessão inválida — sai e inicia sessão novamente." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const courseIds: string[] = Array.isArray(body.courseIds)
      ? body.courseIds.filter((id: unknown): id is string => typeof id === "string")
      : typeof body.courseId === "string"
        ? [body.courseId]
        : [];

    if (courseIds.length === 0) {
      return NextResponse.json({ error: "courseId em falta" }, { status: 400 });
    }

    const courses = await prisma.course.findMany({ where: { id: { in: courseIds }, published: true } });
    if (courses.length !== new Set(courseIds).size) {
      return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });
    }

    const alreadyEnrolled = await prisma.enrollment.findMany({
      where: { userId: session.user.id, courseId: { in: courseIds } },
      select: { courseId: true },
    });
    const enrolledIds = new Set(alreadyEnrolled.map((e) => e.courseId));
    const toAdd = courseIds.filter((id) => !enrolledIds.has(id));

    if (toAdd.length > 0) {
      await prisma.$transaction(
        toAdd.map((courseId) =>
          prisma.cartItem.upsert({
            where: { userId_courseId: { userId: session.user.id, courseId } },
            update: {},
            create: { userId: session.user.id, courseId },
          })
        )
      );
    }

    const count = await prisma.cartItem.count({ where: { userId: session.user.id } });
    return NextResponse.json({ count }, { status: 201 });
  } catch (error) {
    console.error("POST /api/cart failed:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: `Erro ao adicionar ao carrinho: ${message}` }, { status: 500 });
  }
}
