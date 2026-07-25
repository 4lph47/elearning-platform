import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { usernameSchema } from "@/lib/validations";

const USERNAME_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

function nextChangeAt(usernameChangedAt: Date | null) {
  if (!usernameChangedAt) return null;
  const at = new Date(usernameChangedAt.getTime() + USERNAME_COOLDOWN_MS);
  return at > new Date() ? at : null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, usernameChangedAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  return NextResponse.json({
    username: user.username,
    canChangeAt: nextChangeAt(user.usernameChangedAt)?.toISOString() ?? null,
  });
}

// Username só pode ser trocado a cada 14 dias (usernameChangedAt fica null
// na escolha inicial do registo, por isso a primeira troca nunca tem de
// esperar — só entra em cooldown depois de já ter sido trocado uma vez).
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = usernameSchema.safeParse((await request.json()).username);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const username = parsed.data;

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, usernameChangedAt: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (username === current.username) {
    return NextResponse.json({ username, canChangeAt: nextChangeAt(current.usernameChangedAt)?.toISOString() ?? null });
  }

  const blockedUntil = nextChangeAt(current.usernameChangedAt);
  if (blockedUntil) {
    return NextResponse.json(
      { error: "Só podes trocar de username a cada 14 dias", canChangeAt: blockedUntil.toISOString() },
      { status: 429 }
    );
  }

  const usernameTaken = await prisma.user.findFirst({
    where: { username, id: { not: session.user.id } },
  });
  if (usernameTaken) {
    return NextResponse.json({ error: "Esse username já está em uso" }, { status: 409 });
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { username, usernameChangedAt: now },
  });

  return NextResponse.json({ username, canChangeAt: new Date(now.getTime() + USERNAME_COOLDOWN_MS).toISOString() });
}
