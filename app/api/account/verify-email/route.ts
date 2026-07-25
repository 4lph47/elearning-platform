import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyEmailCodeSchema } from "@/lib/validations";
import { isRateLimited } from "@/lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (isRateLimited(`verify-email:${session.user.id}`, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Demasiadas tentativas. Tenta novamente mais tarde." }, { status: 429 });
  }

  const parsed = verifyEmailCodeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  if (
    !user.emailVerificationCode ||
    !user.emailVerificationCodeExpires ||
    user.emailVerificationCodeExpires < new Date()
  ) {
    return NextResponse.json({ error: "Código expirado. Pede um novo." }, { status: 400 });
  }
  if (user.emailVerificationCode !== parsed.data.code) {
    return NextResponse.json({ error: "Código incorreto" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date(), emailVerificationCode: null, emailVerificationCodeExpires: null },
  });

  return NextResponse.json({ ok: true });
}
