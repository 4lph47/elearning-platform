import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isRateLimited } from "@/lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 8;

const passwordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password deve ter pelo menos 8 caracteres").max(200),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (isRateLimited(`settings-password:${session.user.id}`, MAX_REQUESTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Demasiadas tentativas. Tenta novamente mais tarde." }, { status: 429 });
  }

  const parsed = passwordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  // Contas Google/link mágico sem password ainda não têm currentPassword a
  // validar — é a primeira vez que definem uma. Contas que já têm hash
  // exigem sempre a password atual antes de trocar.
  if (user.passwordHash) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Indica a password atual" }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Password atual incorreta" }, { status: 400 });
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true, hadPassword: Boolean(user.passwordHash) });
}
