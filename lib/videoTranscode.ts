import { prisma } from "@/lib/db";
import { getYouTubeId } from "@/lib/youtube";

// Só vídeos auto-alojados precisam de transcode — um link do YouTube já vem
// com o seletor de qualidade do próprio player deles.
export function needsTranscode(type: string | undefined, contentUrl: string | null | undefined): contentUrl is string {
  return type === "VIDEO" && Boolean(contentUrl) && !getYouTubeId(contentUrl!);
}

// Chamado sempre que uma aula fica com um contentUrl de vídeo novo (criação,
// ou edição a trocar o ficheiro) — as renditions antigas já não correspondem
// ao vídeo atual, por isso saem, e entra um job novo para o worker (fora do
// Vercel, ver app/api/worker/jobs) gerar as de novo.
export async function requeueTranscode(lessonId: string, sourceUrl: string) {
  await prisma.$transaction([
    prisma.lessonVideoRendition.deleteMany({ where: { lessonId } }),
    prisma.lesson.update({ where: { id: lessonId }, data: { hlsMasterUrl: null } }),
    prisma.videoTranscodeJob.create({ data: { lessonId, sourceUrl } }),
  ]);
}
