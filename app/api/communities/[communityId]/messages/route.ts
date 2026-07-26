import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { communityMessageSchema } from "@/lib/validations";
import { getMembership } from "@/lib/communityAccess";

const TAKE = 100;

export async function GET(_request: Request, { params }: { params: Promise<{ communityId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId } = await params;
  const membership = await getMembership(communityId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Só membros veem as mensagens" }, { status: 403 });

  const messages = await prisma.communityMessage.findMany({
    where: { communityId },
    orderBy: { createdAt: "asc" },
    take: TAKE,
    include: {
      sender: { select: { id: true, name: true, image: true } },
      replyTo: { include: { sender: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json({ messages });
}

export async function POST(request: Request, { params }: { params: Promise<{ communityId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId } = await params;
  const membership = await getMembership(communityId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Só membros podem enviar mensagens" }, { status: 403 });

  const parsed = communityMessageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { replyToId, ...data } = parsed.data;
  if (replyToId) {
    const original = await prisma.communityMessage.findUnique({ where: { id: replyToId }, select: { communityId: true } });
    if (!original || original.communityId !== communityId) {
      return NextResponse.json({ error: "Mensagem original inválida" }, { status: 400 });
    }
  }

  const message = await prisma.communityMessage.create({
    data: { communityId, senderId: session.user.id, replyToId, ...data },
    include: {
      sender: { select: { id: true, name: true, image: true } },
      replyTo: { include: { sender: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json(message, { status: 201 });
}
