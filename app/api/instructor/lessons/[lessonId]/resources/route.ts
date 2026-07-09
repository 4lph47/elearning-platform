import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOwnedLesson } from "@/lib/instructor-guard";

function mimeToResourceType(mimeType: string): "PDF" | "IMAGE" | "VIDEO" | "OTHER" {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  return "OTHER";
}

export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { lessonId } = await params;
  const lesson = await getOwnedLesson(lessonId, session);
  if (!lesson) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });

  const body = await request.json();
  const { name, url, mimeType, sizeBytes } = body;
  if (typeof name !== "string" || typeof url !== "string" || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Dados de recurso inválidos" }, { status: 400 });
  }

  const resource = await prisma.lessonResource.create({
    data: {
      lessonId,
      name,
      url,
      sizeBytes,
      type: mimeToResourceType(mimeType ?? ""),
    },
  });

  return NextResponse.json(resource, { status: 201 });
}
