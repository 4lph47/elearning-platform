import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRequirements } from "@/lib/communityAccess";

export async function POST(_request: Request, { params }: { params: Promise<{ communityId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId } = await params;
  const community = await prisma.community.findUnique({ where: { id: communityId }, select: { id: true } });
  if (!community) return NextResponse.json({ error: "Comunidade não encontrada" }, { status: 404 });

  // Nunca confia só no que o ecrã de aceitação já mostrou — reverifica aqui,
  // mesmo que o cliente ache que cumpre tudo.
  const results = await checkRequirements(communityId, session.user.id);
  const unmet = results.filter((r) => !r.met);
  if (unmet.length > 0) {
    return NextResponse.json(
      { error: `Não cumpres todos os requisitos: ${unmet.map((r) => r.label).join(", ")}` },
      { status: 403 }
    );
  }

  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId, userId: session.user.id } },
    create: { communityId, userId: session.user.id, role: "MEMBER" },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
