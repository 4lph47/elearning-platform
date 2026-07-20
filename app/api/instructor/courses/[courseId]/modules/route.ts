import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { moduleSchema } from "@/lib/validations";
import { getOwnedCourse } from "@/lib/instructor-guard";

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, session);
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = moduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const courseModule = await prisma.module.create({
    data: { ...parsed.data, courseId },
  });
  revalidateTag("courses");

  return NextResponse.json(courseModule, { status: 201 });
}
