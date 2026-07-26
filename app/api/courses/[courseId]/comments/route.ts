import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  COURSE_COMMENTS_PAGE_SIZE,
  getCourseCommentsCounts,
  getRawCourseComments,
  toCourseCommentTree,
} from "@/lib/courseComments";

// Force dynamic rendering
export const dynamic = "force-dynamic";

const commentSchema = z.object({
  content: z.string().min(1, "Escreve um comentário").max(2000),
  parentId: z.string().optional().nullable(),
});

// Público — a página do curso mostra comentários mesmo a quem não tem
// sessão (é uma página de descoberta, incluindo vinda do marketplace).
export async function GET(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  const { courseId } = await params;

  const url = new URL(request.url);
  const skip = Math.max(0, Number(url.searchParams.get("skip")) || 0);
  const take = Math.min(50, Math.max(1, Number(url.searchParams.get("take")) || COURSE_COMMENTS_PAGE_SIZE));

  const [raw, counts] = await Promise.all([
    getRawCourseComments(courseId, skip, take),
    getCourseCommentsCounts(courseId),
  ]);

  return NextResponse.json({
    comments: toCourseCommentTree(raw, session?.user.id ?? null),
    total: counts.all,
    hasMore: skip + raw.length < counts.topLevel,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { courseId } = await params;
  const parsed = commentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, published: true } });
  if (!course || !course.published) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  if (parsed.data.parentId) {
    const parent = await prisma.courseComment.findUnique({ where: { id: parsed.data.parentId } });
    if (!parent || parent.courseId !== courseId) {
      return NextResponse.json({ error: "Comentário original não encontrado" }, { status: 404 });
    }
  }

  const comment = await prisma.courseComment.create({
    data: { courseId, userId: session.user.id, content: parsed.data.content, parentId: parsed.data.parentId ?? null },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json(comment, { status: 201 });
}
