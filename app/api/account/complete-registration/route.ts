import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeStudentSchema } from "@/lib/validations";

// Passo final de quem entrou por Google/link mágico e ficou como aluno em
// /register/complete — escolhe username e marca os termos como aceites.
// Quem se torna instrutor nesse mesmo ecrã passa antes por
// /api/account/become-instructor, que já faz o mesmo (com o seu próprio
// username).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const parsed = completeStudentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const usernameTaken = await prisma.user.findFirst({
    where: { username: parsed.data.username, id: { not: session.user.id } },
  });
  if (usernameTaken) {
    return NextResponse.json({ error: "Esse username já está em uso" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { username: parsed.data.username, termsAcceptedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
