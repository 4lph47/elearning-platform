import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Alvo único para links de menção (@Nome nos comentários) — não sabemos ali
// se quem foi mencionado é instrutor ou aluno, por isso resolve o papel aqui
// e encaminha para a página pública certa.
export default async function UserProfileRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!user) notFound();
  redirect(user.role === "INSTRUCTOR" ? `/instructors/${id}` : `/students/${id}`);
}
