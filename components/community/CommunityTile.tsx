import Image from "next/image";
import { Users } from "lucide-react";
import { FadeLink } from "@/components/course/FadeLink";

export interface CommunityCardData {
  id: string;
  name: string;
  category: string;
  coverImageUrl: string | null;
  memberCount: number;
}

// Mesma estrutura visual dos outros tiles (capa 16:9 em cima, texto em
// baixo) — sem o voo do CardTransitionContext (esse mecanismo é para
// cursos/perfis/bundles, uma comunidade não tem "página de chegada" com
// vídeo/avatar pra animar até lá, só entra normal).
export function CommunityTile({ community }: { community: CommunityCardData }) {
  return (
    <FadeLink href={`/communities/${community.id}`} className="group block">
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 ring-1 ring-white/10 transition-all duration-200 group-hover:ring-slate-400 dark:group-hover:ring-white/40">
        {community.coverImageUrl ? (
          <Image
            src={community.coverImageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 90vw, 320px"
            className="object-cover"
          />
        ) : (
          <Users size={32} className="text-slate-500" />
        )}
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">
          <Users size={11} /> {community.memberCount}
        </span>
      </div>
      <div className="mt-2.5">
        <h3 className="line-clamp-1 font-semibold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
          {community.name}
        </h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{community.category}</p>
      </div>
    </FadeLink>
  );
}
