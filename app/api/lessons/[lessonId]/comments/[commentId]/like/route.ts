import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { revalidateTag } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commentsTag } from "@/lib/commentsCache";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string; commentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { lessonId, commentId } = await params;
  const comment = await prisma.lessonComment.findUnique({ where: { id: commentId } });
  if (!comment || comment.lessonId !== lessonId) {
    return NextResponse.json({ error: "Comentário não encontrado" }, { status: 404 });
  }

  const existing = await prisma.commentLike.findUnique({
    where: { userId_commentId: { userId: session.user.id, commentId } },
  });

  let liked: boolean;
  if (existing) {
    await prisma.commentLike.delete({ where: { id: existing.id } });
    liked = false;
  } else {
    await prisma.commentLike.create({ data: { userId: session.user.id, commentId } });
    liked = true;
  }

  const likeCount = await prisma.commentLike.count({ where: { commentId } });
  revalidateTag(commentsTag(lessonId));
  return NextResponse.json({ liked, likeCount });
}
