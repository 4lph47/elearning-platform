import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { bundleUpdateSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { bundleId } = await params;
  const body = await request.json();
  const parsed = bundleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const bundle = await prisma.bundle.findUnique({ where: { id: bundleId } });
  if (!bundle || bundle.instructorId !== session.user.id) {
    return NextResponse.json({ error: "Bundle não encontrado" }, { status: 404 });
  }

  const { name, courseIds } = parsed.data;

  if (courseIds) {
    const courses = await prisma.course.findMany({
      where: { id: { in: courseIds }, instructorId: session.user.id, OR: [{ bundleId: null }, { bundleId }] },
    });
    if (courses.length !== courseIds.length) {
      return NextResponse.json(
        { error: "Algum curso não existe, não te pertence ou já está noutro bundle" },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.course.updateMany({ where: { bundleId, id: { notIn: courseIds } }, data: { bundleId: null } }),
      prisma.course.updateMany({ where: { id: { in: courseIds } }, data: { bundleId } }),
      ...(name !== undefined ? [prisma.bundle.update({ where: { id: bundleId }, data: { name } })] : []),
    ]);
  } else if (name !== undefined) {
    await prisma.bundle.update({ where: { id: bundleId }, data: { name } });
  }

  const updated = await prisma.bundle.findUnique({
    where: { id: bundleId },
    include: { courses: { select: { id: true, title: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ bundleId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { bundleId } = await params;
  const bundle = await prisma.bundle.findUnique({ where: { id: bundleId } });
  if (!bundle || bundle.instructorId !== session.user.id) {
    return NextResponse.json({ error: "Bundle não encontrado" }, { status: 404 });
  }

  // Cursos sobrevivem soltos — Course.bundleId é SetNull no schema.
  await prisma.bundle.delete({ where: { id: bundleId } });
  return new NextResponse(null, { status: 204 });
}
