import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GDPR direito ao esquecimento. Instrutor com cursos fica de fora do
// self-service: apagar o User em cascata (schema.prisma) apagaria os cursos
// também, cortando o acesso de todos os alunos inscritos — precisa de
// transferir/arquivar os cursos primeiro, à mão (contactar suporte).
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const coursesTaughtCount = await prisma.course.count({ where: { instructorId: session.user.id } });
  if (coursesTaughtCount > 0) {
    return NextResponse.json(
      { error: "Tens cursos publicados como instrutor. Contacta o suporte para transferir ou remover os cursos antes de apagar a conta." },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id: session.user.id } });
  return NextResponse.json({ ok: true });
}
