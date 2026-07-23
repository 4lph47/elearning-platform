import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAuthorizedWorker } from "@/lib/workerAuth";

const bodySchema = z.object({ error: z.string().min(1).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isAuthorizedWorker(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { jobId } = await params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await prisma.videoTranscodeJob.update({
    where: { id: jobId },
    data: { status: "FAILED", error: parsed.data.error },
  });

  return NextResponse.json({ ok: true });
}
