import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getResaleEligibility } from "@/lib/resale";

// Só quem já está inscrito (ou é o próprio instrutor) vê o mínimo de
// comissão de um curso — nunca aparece no catálogo público, evita expor
// informação de negociação a quem nem comprou o curso.
export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const { courseId } = await params;
  const eligibility = await getResaleEligibility(courseId, session.user.id);
  if (!eligibility) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  return NextResponse.json(eligibility);
}
