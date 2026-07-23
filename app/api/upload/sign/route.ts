import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSignedUpload } from "@/lib/storage";
import { validateUpload } from "@/lib/validations";

export const runtime = "nodejs";

// Só vídeo e documentos — imagens continuam a passar por app/api/upload
// (precisam de compressão server-side com sharp, e são pequenas o
// suficiente para caberem no limite de corpo do Vercel).
const ALLOWED_KINDS = ["VIDEO", "DOCUMENT"] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { kind, fileName, mimeType, sizeBytes } = body as {
    kind?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  if (typeof kind !== "string" || !ALLOWED_KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: "Tipo de conteúdo inválido" }, { status: 400 });
  }
  if (typeof fileName !== "string" || typeof mimeType !== "string" || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Dados de envio inválidos" }, { status: 400 });
  }

  const validation = validateUpload(kind as Kind, mimeType, sizeBytes);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const signed = await createSignedUpload(kind, fileName);

  return NextResponse.json({
    signedUrl: signed.signedUrl,
    token: signed.token,
    path: signed.path,
    publicUrl: signed.publicUrl,
    bucket: signed.bucket,
    name: fileName,
    mimeType,
  });
}
