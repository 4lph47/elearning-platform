import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, Users } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRequirements } from "@/lib/communityAccess";
import { CommunityChat } from "@/components/community/CommunityChat";
import { JoinButton } from "@/components/community/JoinButton";
import { FadeLink } from "@/components/course/FadeLink";

export const dynamic = "force-dynamic";

// Membro vê o chat a ecrã inteiro (CommunityChat); quem não é membro vê o
// "perfil" da comunidade (banner+avatar, tal como o perfil público de um
// aluno/instrutor) com o ecrã de aceitação (JoinButton) em vez do chat.
export default async function CommunityPage({ params }: { params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/communities/${communityId}`)}`);

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    include: { _count: { select: { members: true } } },
  });
  if (!community) notFound();

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: session.user.id } },
    select: { role: true },
  });

  if (membership) {
    return (
      <CommunityChat
        communityId={community.id}
        communityName={community.name}
        coverImageUrl={community.coverImageUrl}
        memberCount={community._count.members}
        currentUserId={session.user.id}
        currentUserRole={membership.role}
        rules={community.rules}
      />
    );
  }

  const requirementResults = await checkRequirements(communityId, session.user.id);

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {community.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={community.bannerUrl} alt="" className="h-40 w-full object-cover sm:h-56" />
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-blue-600 to-indigo-700 sm:h-56" />
      )}

      <div className="mx-auto max-w-2xl px-4 pb-10 sm:px-8">
        <div className="-mt-10 flex items-end gap-4">
          {community.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={community.coverImageUrl}
              alt=""
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-white dark:ring-black"
            />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-200 text-2xl font-bold text-slate-700 ring-4 ring-white dark:bg-slate-700 dark:text-slate-200 dark:ring-black">
              {community.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="mt-3">
          <FadeLink
            href="/communities"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft size={14} /> Comunidades
          </FadeLink>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{community.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <Users size={14} /> {community._count.members} membro{community._count.members !== 1 ? "s" : ""} · {community.category}
          </p>
          {community.description && (
            <p className="mt-3 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{community.description}</p>
          )}
          {community.rules && (
            <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
              <p className="mb-1 font-semibold text-slate-900 dark:text-white">Regras</p>
              <p className="whitespace-pre-wrap">{community.rules}</p>
            </div>
          )}

          <div className="mt-5">
            <JoinButton communityId={community.id} requirements={requirementResults} hasRules={Boolean(community.rules)} />
          </div>
        </div>
      </div>
    </div>
  );
}
