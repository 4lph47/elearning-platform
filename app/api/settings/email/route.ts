import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateVerificationCode, sendVerificationCodeEmail } from "@/lib/sendVerificationCodeEmail";
import { isRateLimited } from "@/lib/rateLimit";

const CODE_TTL_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
});

// Trocar de email reabre o mesmo fluxo de verificação por código do registo
// (ver app/api/account/verify-email) — o middleware (lib/auth.ts "registered")
// já tranca contas por password sem emailVerified, por isso não precisa de
// lógica extra aqui além de repor os dois campos e reenviar o código.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (isRateLimited(`settings-email:${session.user.id}`, MAX_REQUESTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Demasiadas tentativas. Tenta novamente mais tarde." }, { status: 429 });
  }

  const parsed = emailSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { email } = parsed.data;

  const current = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!current) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  if (email === current.email) {
    return NextResponse.json({ error: "Esse já é o teu email atual" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma conta com este email" }, { status: 409 });
  }

  const code = generateVerificationCode();
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      email,
      emailVerified: null,
      emailVerificationCode: code,
      emailVerificationCodeExpires: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  await sendVerificationCodeEmail(email, code);

  return NextResponse.json({ ok: true, email });
}
