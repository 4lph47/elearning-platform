import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canonicalPair } from "@/lib/conversations";

const TAKE = 100;

export async function GET(_request: Request, { params }: { params: Promise<{ otherUserId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { otherUserId } = await params;
  const [userAId, userBId] = canonicalPair(session.user.id, otherUserId);

  const conversation = await prisma.conversation.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: "asc" },
        take: TAKE,
        select: { id: true, content: true, createdAt: true, senderId: true },
      },
    },
  });

  // Abrir o chat conta como "ler" as mensagens desta pessoa — sem isto a
  // campainha continuava a marcar como não lida mesmo depois de já teres
  // visto a conversa.
  await prisma.notification.updateMany({
    where: { recipientId: session.user.id, actorId: otherUserId, type: "DIRECT_MESSAGE", read: false },
    data: { read: true },
  });

  return NextResponse.json({ messages: conversation?.messages ?? [] });
}
