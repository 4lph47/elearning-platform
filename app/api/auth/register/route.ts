import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validations";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 8;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`register:${ip}`, MAX_REQUESTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Demasiadas tentativas. Tenta novamente mais tarde." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, email, password, wantsToTeach } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Já existe uma conta com este email" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: wantsToTeach ? "INSTRUCTOR" : "STUDENT",
    },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
