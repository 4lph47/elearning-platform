import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { communityUpdateSchema } from "@/lib/validations";
import { getMembership, canModerate } from "@/lib/communityAccess";

export async function PATCH(request: Request, { params }: { params: Promise<{ communityId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId } = await params;
  const membership = await getMembership(communityId, session.user.id);
  if (!canModerate(membership?.role)) {
    return NextResponse.json({ error: "Só administradores podem editar a comunidade" }, { status: 403 });
  }

  const parsed = communityUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updated = await prisma.community.update({ where: { id: communityId }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ communityId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { communityId } = await params;
  const membership = await getMembership(communityId, session.user.id);
  if (membership?.role !== "OWNER") {
    return NextResponse.json({ error: "Só o criador pode eliminar a comunidade" }, { status: 403 });
  }

  await prisma.community.delete({ where: { id: communityId } });
  return new NextResponse(null, { status: 204 });
}
