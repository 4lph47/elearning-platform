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

// Bucket Supabase trava em 50MB por objeto (plano Free, sem exceção) — vídeo
// sobe em partes bem abaixo disso (ver FileUploadInput.tsx), cada uma com o
// seu próprio pedido de assinatura, todas na mesma pasta (groupId).
const PART_MAX_BYTES = 45 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { kind, fileName, mimeType, sizeBytes, groupId, partName } = body as {
    kind?: string;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    groupId?: string;
    partName?: string;
  };

  if (typeof kind !== "string" || !ALLOWED_KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: "Tipo de conteúdo inválido" }, { status: 400 });
  }
  if (typeof fileName !== "string" || typeof mimeType !== "string" || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Dados de envio inválidos" }, { status: 400 });
  }

  const isPart = typeof groupId === "string" && typeof partName === "string";
  if (isPart) {
    if (!/^[a-zA-Z0-9_-]+$/.test(groupId) || !/^[a-zA-Z0-9_.-]+$/.test(partName)) {
      return NextResponse.json({ error: "Identificador de parte inválido" }, { status: 400 });
    }
    if (sizeBytes > PART_MAX_BYTES) {
      return NextResponse.json({ error: `Cada parte tem de ficar abaixo de ${PART_MAX_BYTES / (1024 * 1024)}MB` }, { status: 400 });
    }
  } else {
    const validation = validateUpload(kind as Kind, mimeType, sizeBytes);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  const objectPath = isPart ? `${kind.toLowerCase()}s/${groupId}/${partName}` : undefined;
  const signed = await createSignedUpload(kind, fileName, objectPath);

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
