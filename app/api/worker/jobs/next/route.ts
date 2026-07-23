import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedWorker } from "@/lib/workerAuth";

// SELECT ... FOR UPDATE SKIP LOCKED: se houver mais de uma instância do
// worker a fazer poll ao mesmo tempo, cada uma reclama um job diferente em
// vez de as duas pegarem no mesmo (uma simples SELECT+UPDATE do Prisma
// deixava essa janela de corrida aberta).
export async function GET(request: Request) {
  if (!isAuthorizedWorker(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const rows = await prisma.$queryRaw<{ id: string; lessonId: string; sourceUrl: string }[]>`
    UPDATE "VideoTranscodeJob"
    SET status = 'PROCESSING', "updatedAt" = now()
    WHERE id = (
      SELECT id FROM "VideoTranscodeJob"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, "lessonId", "sourceUrl"
  `;

  const job = rows[0];
  if (!job) return NextResponse.json({ job: null });

  return NextResponse.json({ job: { id: job.id, lessonId: job.lessonId, sourceUrl: job.sourceUrl } });
}
