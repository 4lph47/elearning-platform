import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, Users } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FadeLink } from "@/components/course/FadeLink";
import { MembersList } from "@/components/community/MembersList";
import { CommunityInfoActions } from "@/components/community/CommunityInfoActions";

export const dynamic = "force-dynamic";

// Ecrã de info da comunidade — banner/avatar/nome/descrição/regras e, logo
// abaixo do título, a lista de membros — aberto ao clicar na parte de cima
// do chat (CommunityChat), tal como o ecrã de info de um grupo no
// WhatsApp/Telegram. Só membros entram aqui; quem não é membro vai para a
// página normal da comunidade (ecrã de aceitação).
export default async function CommunityInfoPage({ params }: { params: Promise<{ communityId: string }> }) {
  const { communityId } = await params;
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent(`/communities/${communityId}/info`)}`);

  const community = await prisma.community.findUnique({
    where: { id: communityId },
    include: { _count: { select: { members: true } } },
  });
  if (!community) notFound();

  const membership = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId: session.user.id } },
    select: { role: true },
  });
  if (!membership) redirect(`/communities/${communityId}`);

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {community.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={community.bannerUrl} alt="" className="h-36 w-full object-cover sm:h-48" />
      ) : (
        <div className="h-36 w-full bg-gradient-to-br from-blue-600 to-indigo-700 sm:h-48" />
      )}

      <div className="mx-auto max-w-2xl px-4 pb-10 sm:px-8">
        <div className="-mt-10 flex items-end justify-between gap-4">
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
            href={`/communities/${communityId}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft size={14} /> Voltar ao chat
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

          {/* Lista de membros logo abaixo do título — pedido explícito do
              utilizador ("a lista de membros em baixo do titulo"). */}
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
              Membros ({community._count.members})
            </h2>
            <MembersList communityId={communityId} currentUserId={session.user.id} currentUserRole={membership.role} />
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-white/10">
            <CommunityInfoActions communityId={communityId} isOwner={membership.role === "OWNER"} />
          </div>
        </div>
      </div>
    </div>
  );
}
