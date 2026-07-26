import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMembership, canModerate } from "@/lib/communityAccess";

const roleSchema = z.object({ role: z.enum(["ADMIN", "MEMBER"]) });

// Promover/despromover (PATCH) ou remover (DELETE) outro membro. Um ADMIN só
// mexe em MEMBER comuns — nunca noutro ADMIN nem no OWNER — só o OWNER tem
// esse alcance todo (evita ADMINs a "guerrear" entre si por controlo do
// grupo).
export async function PATCH(request: Request, { params }: { params: Promise<{ communityId: string; userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId, userId } = await params;
  const actorMembership = await getMembership(communityId, session.user.id);
  if (!canModerate(actorMembership?.role)) {
    return NextResponse.json({ error: "Não tens permissão para gerir membros" }, { status: 403 });
  }

  const parsed = roleSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Papel inválido" }, { status: 400 });

  const targetMembership = await getMembership(communityId, userId);
  if (!targetMembership) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  if (targetMembership.role === "OWNER") {
    return NextResponse.json({ error: "O criador não pode ser alterado" }, { status: 400 });
  }
  if (targetMembership.role === "ADMIN" && actorMembership?.role !== "OWNER") {
    return NextResponse.json({ error: "Só o criador pode alterar outro administrador" }, { status: 403 });
  }

  await prisma.communityMember.update({
    where: { communityId_userId: { communityId, userId } },
    data: { role: parsed.data.role },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ communityId: string; userId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId, userId } = await params;
  const actorMembership = await getMembership(communityId, session.user.id);
  if (!canModerate(actorMembership?.role)) {
    return NextResponse.json({ error: "Não tens permissão para remover membros" }, { status: 403 });
  }

  const targetMembership = await getMembership(communityId, userId);
  if (!targetMembership) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
  if (targetMembership.role === "OWNER") {
    return NextResponse.json({ error: "O criador não pode ser removido" }, { status: 400 });
  }
  if (targetMembership.role === "ADMIN" && actorMembership?.role !== "OWNER") {
    return NextResponse.json({ error: "Só o criador pode remover outro administrador" }, { status: 403 });
  }

  await prisma.communityMember.delete({ where: { communityId_userId: { communityId, userId } } });
  return new NextResponse(null, { status: 204 });
}
