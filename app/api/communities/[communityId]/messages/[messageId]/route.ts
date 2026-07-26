import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMembership, canModerate } from "@/lib/communityAccess";

// Apagar (estilo WhatsApp): o próprio autor sempre pode; um moderador
// (OWNER/ADMIN) também pode apagar mensagens de outros membros. A linha
// fica (para não partir respostas que a citem), só limpa o conteúdo.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ communityId: string; messageId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId, messageId } = await params;
  const membership = await getMembership(communityId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Não és membro desta comunidade" }, { status: 403 });

  const message = await prisma.communityMessage.findUnique({ where: { id: messageId } });
  if (!message || message.communityId !== communityId) {
    return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 });
  }
  if (message.senderId !== session.user.id && !canModerate(membership.role)) {
    return NextResponse.json({ error: "Não podes apagar esta mensagem" }, { status: 403 });
  }

  const updated = await prisma.communityMessage.update({
    where: { id: messageId },
    data: { content: null, attachmentUrl: null, attachmentType: null, attachmentName: null, deleted: true },
    include: {
      sender: { select: { id: true, name: true, image: true } },
      replyTo: { include: { sender: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json(updated);
}
