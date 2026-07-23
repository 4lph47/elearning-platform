import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAuthorizedWorker } from "@/lib/workerAuth";

const bodySchema = z.object({
  // Uma rendition (variante HLS) concluída, reportada assim que fica pronta
  // — não à espera do resto da escada de qualidade, para o vídeo ficar
  // reproduzível o mais cedo possível.
  rendition: z.object({
    quality: z.string().min(1),
    url: z.string().url(),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    sizeBytes: z.number().int().min(0),
  }),
  // Master playlist (.m3u8) já reescrito pelo worker com esta rendition
  // incluída — grava-se na aula em cada chamada, por isso cresce aos poucos.
  masterPlaylistUrl: z.string().url(),
  // true só na última rendition da escada — fecha o job.
  final: z.boolean(),
});

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isAuthorizedWorker(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { jobId } = await params;
  const job = await prisma.videoTranscodeJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { rendition: r, masterPlaylistUrl, final } = parsed.data;

  await prisma.$transaction([
    prisma.lessonVideoRendition.upsert({
      where: { lessonId_quality: { lessonId: job.lessonId, quality: r.quality } },
      create: { lessonId: job.lessonId, ...r },
      update: { url: r.url, width: r.width, height: r.height, sizeBytes: r.sizeBytes },
    }),
    prisma.lesson.update({ where: { id: job.lessonId }, data: { hlsMasterUrl: masterPlaylistUrl } }),
    ...(final ? [prisma.videoTranscodeJob.update({ where: { id: jobId }, data: { status: "DONE" as const, error: null } })] : []),
  ]);

  return NextResponse.json({ ok: true });
}
