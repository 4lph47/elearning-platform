import { prisma } from "@/lib/db";
import { getYouTubeId } from "@/lib/youtube";

// Vídeo enviado por FileUploadInput já vem comprimido — o worker faz HLS
// ANTES de o browser sequer receber um contentUrl de volta (ver
// app/api/upload/authorize-direct, worker/index.js:handleUploadRequest),
// então o que chega aqui já é o master.m3u8 pronto, não um vídeo bruto.
export function isProcessedHlsUrl(contentUrl: string | null | undefined): contentUrl is string {
  return Boolean(contentUrl) && contentUrl!.endsWith("/master.m3u8");
}

// Só entra na fila assíncrona quem NÃO passou pelo upload direto — um link
// do YouTube (já tem o seu próprio player) ou um URL de vídeo colado à mão
// (caminho de recurso, ver worker/README.md).
export function needsTranscode(type: string | undefined, contentUrl: string | null | undefined): contentUrl is string {
  return type === "VIDEO" && Boolean(contentUrl) && !getYouTubeId(contentUrl!) && !isProcessedHlsUrl(contentUrl);
}

// Chamado só no caminho de recurso (fallback) — um URL de vídeo colado à
// mão que ainda não passou por compressão nenhuma.
export async function requeueTranscode(lessonId: string, sourceUrl: string) {
  await prisma.$transaction([
    prisma.lessonVideoRendition.deleteMany({ where: { lessonId } }),
    prisma.lesson.update({ where: { id: lessonId }, data: { hlsMasterUrl: null } }),
    prisma.videoTranscodeJob.create({ data: { lessonId, sourceUrl } }),
  ]);
}
