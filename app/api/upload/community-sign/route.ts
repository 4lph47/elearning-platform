import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createSignedUpload } from "@/lib/storage";
import { validateUpload } from "@/lib/validations";

export const runtime = "nodejs";

// Irmão mais aberto de /api/upload/sign — esse é só para instrutores
// (autoria de curso); anexos de comunidade podem vir de QUALQUER membro
// (aluno ou instrutor), por isso esta rota própria sem esse gate de role.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Precisas de iniciar sessão" }, { status: 401 });

  const body = await request.json();
  const { fileName, mimeType, sizeBytes } = body as {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  };
  if (typeof fileName !== "string" || typeof mimeType !== "string" || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Dados de envio inválidos" }, { status: 400 });
  }

  const validation = validateUpload("COMMUNITY_ATTACHMENT", mimeType, sizeBytes);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const signed = await createSignedUpload("COMMUNITY_ATTACHMENT", fileName);

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
