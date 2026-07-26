import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { communityMessageSchema } from "@/lib/validations";
import { getMembership } from "@/lib/communityAccess";

const TAKE = 30;
const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, image: true } },
  replyTo: { include: { sender: { select: { id: true, name: true } } } },
} as const;

// Paginado por cursor de data — carregar as 100+ mensagens todas de uma vez
// não escala (grupos com histórico grande). Três modos:
// - sem parâmetros: as TAKE mais recentes (carga inicial, ecrã já abre no fundo);
// - ?before=<ISO>: TAKE mais antigas que essa data (scroll para cima, "carregar mais");
// - ?after=<ISO>: só as mais novas que essa data (poll, nunca refaz o histórico todo).
export async function GET(request: Request, { params }: { params: Promise<{ communityId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId } = await params;
  const membership = await getMembership(communityId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Só membros veem as mensagens" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  const after = searchParams.get("after");

  if (after) {
    const messages = await prisma.communityMessage.findMany({
      where: { communityId, createdAt: { gt: new Date(after) } },
      orderBy: { createdAt: "asc" },
      take: TAKE,
      include: MESSAGE_INCLUDE,
    });
    return NextResponse.json({ messages, hasMore: false });
  }

  const messages = await prisma.communityMessage.findMany({
    where: { communityId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: TAKE,
    include: MESSAGE_INCLUDE,
  });
  messages.reverse();

  return NextResponse.json({ messages, hasMore: messages.length === TAKE });
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
