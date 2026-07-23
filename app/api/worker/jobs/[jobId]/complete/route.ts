import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAuthorizedWorker } from "@/lib/workerAuth";

const bodySchema = z.object({
  renditions: z
    .array(
      z.object({
        quality: z.string().min(1),
        url: z.string().url(),
        width: z.number().int().min(1),
        height: z.number().int().min(1),
        sizeBytes: z.number().int().min(0),
      })
    )
    .min(1),
});

// O worker já fez o upload das renditions para o Supabase Storage (mesmo
// bucket, credenciais próprias) antes de chamar isto — aqui só regista os
// URLs resultantes e fecha o job.
export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isAuthorizedWorker(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { jobId } = await params;
  const job = await prisma.videoTranscodeJob.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await prisma.$transaction([
    ...parsed.data.renditions.map((r) =>
      prisma.lessonVideoRendition.upsert({
        where: { lessonId_quality: { lessonId: job.lessonId, quality: r.quality } },
        create: { lessonId: job.lessonId, ...r },
        update: { url: r.url, width: r.width, height: r.height, sizeBytes: r.sizeBytes },
      })
    ),
    prisma.videoTranscodeJob.update({ where: { id: jobId }, data: { status: "DONE", error: null } }),
  ]);

  return NextResponse.json({ ok: true });
}
