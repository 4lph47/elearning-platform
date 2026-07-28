import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [accounts, user] = await Promise.all([
    prisma.account.findMany({
      where: { userId: session.user.id },
      select: { id: true, provider: true },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } }),
  ]);

  return NextResponse.json({
    accounts,
    hasPassword: Boolean(user?.passwordHash),
  });
}

// Desliga um provedor OAuth (ex.: Google) — bloqueado se for a única forma
// de entrar na conta (sem password e sem outro provedor ligado), para
// nunca deixar a conta sem nenhum método de login.
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("id");
  if (!accountId) return NextResponse.json({ error: "Id em falta" }, { status: 400 });

  const [accounts, user] = await Promise.all([
    prisma.account.findMany({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } }),
  ]);

  const target = accounts.find((a) => a.id === accountId);
  if (!target) return NextResponse.json({ error: "Ligação não encontrada" }, { status: 404 });

  const wouldHaveNoLogin = !user?.passwordHash && accounts.length <= 1;
  if (wouldHaveNoLogin) {
    return NextResponse.json(
      { error: "Define uma password antes de desligar este login — é o único acesso à tua conta." },
      { status: 400 }
    );
  }

  await prisma.account.delete({ where: { id: accountId } });

  return NextResponse.json({ ok: true });
}
