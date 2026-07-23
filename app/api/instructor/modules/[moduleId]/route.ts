import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { moduleSchema } from "@/lib/validations";
import { getOwnedModule } from "@/lib/instructor-guard";
import { syncCourseThumbnail } from "@/lib/courseThumbnail";

export async function PATCH(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { moduleId } = await params;
  const courseModule = await getOwnedModule(moduleId, session);
  if (!courseModule) return NextResponse.json({ error: "Módulo não encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = moduleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updated = await prisma.module.update({ where: { id: moduleId }, data: parsed.data });
  revalidateTag("courses");
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { moduleId } = await params;
  const courseModule = await getOwnedModule(moduleId, session);
  if (!courseModule) return NextResponse.json({ error: "Módulo não encontrado" }, { status: 404 });

  await prisma.module.delete({ where: { id: moduleId } });
  await syncCourseThumbnail(courseModule.course.id);
  revalidateTag("courses");
  return NextResponse.json({ ok: true });
}
