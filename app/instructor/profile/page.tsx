import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// A edição do perfil passou a ser feita diretamente no perfil público (botão
// "Editar" em /instructors/[id]) — esta rota fica só como redireção para
// quem tinha o link antigo guardado.
export default async function InstructorProfileSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  redirect(`/instructors/${session.user.id}`);
}
