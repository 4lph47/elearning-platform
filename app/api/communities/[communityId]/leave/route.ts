import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMembership } from "@/lib/communityAccess";

export async function POST(_request: Request, { params }: { params: Promise<{ communityId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId } = await params;
  const membership = await getMembership(communityId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Não és membro desta comunidade" }, { status: 404 });
  // O criador não pode sair — só eliminar a comunidade (DELETE /api/communities/[id]),
  // senão ficava sem ninguém a poder geri-la.
  if (membership.role === "OWNER") {
    return NextResponse.json({ error: "O criador não pode sair — elimina a comunidade se quiseres encerrá-la" }, { status: 400 });
  }

  await prisma.communityMember.delete({ where: { communityId_userId: { communityId, userId: session.user.id } } });
  return new NextResponse(null, { status: 204 });
}
