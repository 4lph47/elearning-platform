import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOwnedModule } from "@/lib/instructor-guard";
import { ModuleQuizForm } from "@/components/instructor/ModuleQuizForm";

export const dynamic = "force-dynamic";

export default async function NewModuleQuizPage({
  params,
}: {
  params: Promise<{ courseId: string; moduleId: string }>;
}) {
  const { courseId, moduleId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const courseModule = await getOwnedModule(moduleId, session);
  if (!courseModule || courseModule.courseId !== courseId) notFound();

  return <ModuleQuizForm courseId={courseId} moduleId={moduleId} />;
}
