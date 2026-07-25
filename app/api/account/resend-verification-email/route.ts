import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateVerificationCode, sendVerificationCodeEmail } from "@/lib/sendVerificationCodeEmail";
import { isRateLimited } from "@/lib/rateLimit";

const CODE_TTL_MS = 15 * 60 * 1000;
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 3;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (isRateLimited(`resend-verification:${session.user.id}`, MAX_REQUESTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Espera um pouco antes de pedir outro código." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ error: "Email já verificado" }, { status: 409 });

  const code = generateVerificationCode();
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationCode: code, emailVerificationCodeExpires: new Date(Date.now() + CODE_TTL_MS) },
  });
  await sendVerificationCodeEmail(user.email, code);

  return NextResponse.json({ ok: true });
}
