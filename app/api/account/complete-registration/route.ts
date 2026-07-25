import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Passo final de quem entrou por Google/link mágico e ficou como aluno em
// /register/complete — marca os termos como aceites. Quem se torna
// instrutor nesse mesmo ecrã passa antes por /api/account/become-instructor,
// que já faz este mesmo carimbo.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { termsAcceptedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
