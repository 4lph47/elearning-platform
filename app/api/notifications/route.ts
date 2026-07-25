import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_TAKE = 20;
const MAX_TAKE = 50;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const skip = Math.max(0, Number(url.searchParams.get("skip")) || 0);
  const take = Math.min(MAX_TAKE, Math.max(1, Number(url.searchParams.get("take")) || DEFAULT_TAKE));

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        actor: { select: { id: true, name: true, image: true } },
        comment: { select: { content: true } },
      },
    }),
    prisma.notification.count({ where: { recipientId: session.user.id, read: false } }),
  ]);

  return NextResponse.json({ notifications, unreadCount, hasMore: notifications.length === take });
}
