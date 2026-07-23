import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOwnedCourse } from "@/lib/instructor-guard";
import { syncCourseThumbnail } from "@/lib/courseThumbnail";

const reorderSchema = z.object({ moduleIds: z.array(z.string().min(1)).min(1) });

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, session);
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.moduleIds.map((id, order) => prisma.module.update({ where: { id, courseId }, data: { order } }))
  );
  await syncCourseThumbnail(courseId);

  revalidateTag("courses");
  return NextResponse.json({ ok: true });
}
