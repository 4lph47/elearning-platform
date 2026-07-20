import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
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

  if ("bundle" in body) {
    const bundleInput = body.bundle as { name?: string; courseIds?: string[] } | null;
    const name = bundleInput?.name?.trim();

    await prisma.$transaction(async (tx) => {
      const current = await tx.course.findUnique({ where: { id: courseId }, select: { bundleId: true } });

      if (!name) {
        if (current?.bundleId) {
          await tx.course.update({ where: { id: courseId }, data: { bundleId: null } });
        }
      } else {
        const otherCourseIds = Array.isArray(bundleInput?.courseIds)
          ? bundleInput!.courseIds!.filter((id): id is string => typeof id === "string" && id !== courseId)
          : [];

        let bundleId = current?.bundleId ?? null;
        if (bundleId) {
          await tx.bundle.update({ where: { id: bundleId }, data: { name } });
        } else {
          const bundle = await tx.bundle.create({ data: { name, instructorId: session.user.id } });
          bundleId = bundle.id;
          await tx.course.update({ where: { id: courseId }, data: { bundleId } });
        }

        await tx.course.updateMany({
          where: { bundleId, id: { notIn: [courseId, ...otherCourseIds] } },
          data: { bundleId: null },
        });
        await tx.course.updateMany({
          where: { id: { in: otherCourseIds }, instructorId: session.user.id, published: true },
          data: { bundleId },
        });
      }

      await tx.bundle.deleteMany({ where: { courses: { none: {} } } });
    });
  }

  if ("collaboratorEmails" in body) {
    const emails: string[] = Array.isArray(body.collaboratorEmails)
      ? body.collaboratorEmails.filter((e: unknown): e is string => typeof e === "string" && e.trim() !== "")
      : [];

    const users = await prisma.user.findMany({
      where: { email: { in: emails }, role: { in: ["INSTRUCTOR", "ADMIN"] } },
      select: { id: true, email: true },
    });
    const foundEmails = new Set(users.map((u) => u.email.toLowerCase()));
    const notFound = emails.filter((e) => !foundEmails.has(e.toLowerCase()));
    if (notFound.length > 0) {
      return NextResponse.json(
        { error: `Utilizador(es) não encontrado(s) ou sem conta de instrutor: ${notFound.join(", ")}` },
        { status: 400 }
      );
    }

    await prisma.course.update({
      where: { id: courseId },
      data: {
        collaborators: { set: users.filter((u) => u.id !== course.instructorId).map((u) => ({ id: u.id })) },
      },
    });
  }

  revalidateTag("courses");
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, session);
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  await prisma.course.delete({ where: { id: courseId } });
  revalidateTag("courses");
  return NextResponse.json({ ok: true });
}
