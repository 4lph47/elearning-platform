import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canonicalPair } from "@/lib/conversations";

const sendSchema = z.object({
  recipientId: z.string().min(1),
  content: z.string().trim().min(1, "Escreve uma mensagem").max(2000),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const parsed = sendSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { recipientId, content } = parsed.data;
  if (recipientId === session.user.id) {
    return NextResponse.json({ error: "Não podes conversar contigo próprio" }, { status: 400 });
  }

  const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { id: true } });
  if (!recipient) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  const [userAId, userBId] = canonicalPair(session.user.id, recipientId);
  const conversation = await prisma.conversation.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: { userAId, userBId },
    update: { updatedAt: new Date() },
  });

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: session.user.id, content },
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  // Uma notificação por conversa não lida de cada vez — várias mensagens
  // seguidas da mesma pessoa não devem encher a campainha de entradas
  // repetidas, só a primeira até o destinatário abrir o chat (ver GET abaixo,
  // que marca como lidas).
  const alreadyUnread = await prisma.notification.findFirst({
    where: { recipientId, actorId: session.user.id, type: "DIRECT_MESSAGE", read: false },
    select: { id: true },
  });
  if (!alreadyUnread) {
    await prisma.notification.create({
      data: { type: "DIRECT_MESSAGE", recipientId, actorId: session.user.id },
    });
  }

  return NextResponse.json(message, { status: 201 });
}
