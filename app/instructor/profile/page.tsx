import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { ProfileForm } from "@/components/instructor/ProfileForm";

export const dynamic = "force-dynamic";

export default async function InstructorProfileSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { bio: true } });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Perfil público</h1>
        <Link href={`/instructors/${session.user.id}`} className="text-sm font-medium text-slate-600 hover:text-slate-900">
          Ver perfil público →
        </Link>
      </div>
      <Card className="p-6">
        <ProfileForm initialBio={user?.bio ?? ""} />
      </Card>
    </div>
  );
}
