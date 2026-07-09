import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quizSchema } from "@/lib/validations";
import { getOwnedCourse } from "@/lib/instructor-guard";
import { upsertQuiz, deleteQuiz } from "@/lib/quiz";

export async function PUT(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, session);
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  const body = await request.json();
  const parsed = quizSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const result = await upsertQuiz("COURSE", courseId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json(result.quiz);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { courseId } = await params;
  const course = await getOwnedCourse(courseId, session);
  if (!course) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  await deleteQuiz("COURSE", courseId);
  return NextResponse.json({ ok: true });
}
