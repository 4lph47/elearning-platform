import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; commentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { courseId, commentId } = await params;
  const comment = await prisma.courseComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.courseId !== courseId) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }

  const existing = await prisma.courseCommentLike.findUnique({
    where: { userId_commentId: { userId: session.user.id, commentId } },
  });

  let liked: boolean;
  if (existing) {
    await prisma.courseCommentLike.delete({ where: { id: existing.id } });
    liked = false;
  } else {
    await prisma.courseCommentLike.create({ data: { userId: session.user.id, commentId } });
    liked = true;
  }

  const likeCount = await prisma.courseCommentLike.count({ where: { commentId } });
  return NextResponse.json({ liked, likeCount });
}
