import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMembership } from "@/lib/communityAccess";

export async function GET(_request: Request, { params }: { params: Promise<{ communityId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId } = await params;
  const membership = await getMembership(communityId, session.user.id);
  if (!membership) return NextResponse.json({ error: "Só membros veem a lista" }, { status: 403 });

  const members = await prisma.communityMember.findMany({
    where: { communityId },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    include: { user: { select: { id: true, name: true, image: true, role: true } } },
  });

  return NextResponse.json({ members, viewerRole: membership.role });
}
