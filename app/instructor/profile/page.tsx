import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { ProfileForm } from "@/components/instructor/ProfileForm";
import { SOCIAL_PLATFORMS } from "@/lib/socialPlatforms";
import { FadeLink } from "@/components/course/FadeLink";

export const dynamic = "force-dynamic";

export default async function InstructorProfileSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      bio: true,
      websiteUrl: true,
      twitterUrl: true,
      linkedinUrl: true,
      youtubeUrl: true,
      instagramUrl: true,
      facebookUrl: true,
      tiktokUrl: true,
      githubUrl: true,
      discordUrl: true,
      mediumUrl: true,
      twitchUrl: true,
      certifications: { orderBy: { order: "asc" }, select: { id: true, name: true, url: true } },
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Perfil público</h1>
        <FadeLink
          href={`/instructors/${session.user.id}`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          Ver perfil público →
        </FadeLink>
      </div>
      <Card className="p-6">
        <ProfileForm
          initialBio={user?.bio ?? ""}
          initialValues={Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, user?.[p.key] ?? ""])) as Record<
            (typeof SOCIAL_PLATFORMS)[number]["key"],
            string
          >}
          initialCertifications={user?.certifications.map((c) => ({ name: c.name, url: c.url })) ?? []}
        />
      </Card>
    </div>
  );
}
