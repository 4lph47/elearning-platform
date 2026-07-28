import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { blocked: { select: { id: true, name: true, username: true, image: true } } },
  });

  return NextResponse.json(blocks.map((b) => ({ id: b.id, user: b.blocked })));
}

const blockSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Indica um username"),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const parsed = blockSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!target) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  if (target.id === session.user.id) {
    return NextResponse.json({ error: "Não podes bloquear-te a ti próprio" }, { status: 400 });
  }

  const block = await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: target.id } },
    create: { blockerId: session.user.id, blockedId: target.id },
    update: {},
    include: { blocked: { select: { id: true, name: true, username: true, image: true } } },
  });

  return NextResponse.json({ id: block.id, user: block.blocked }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Id em falta" }, { status: 400 });

  await prisma.userBlock.deleteMany({ where: { id, blockerId: session.user.id } });

  return NextResponse.json({ ok: true });
}
