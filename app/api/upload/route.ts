import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { validateUpload } from "@/lib/validations";

export const runtime = "nodejs";

const ALLOWED_KINDS = ["VIDEO", "DOCUMENT", "IMAGE"] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ficheiro em falta" }, { status: 400 });
  }
  if (typeof kind !== "string" || !ALLOWED_KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: "Tipo de conteúdo inválido" }, { status: 400 });
  }

  const validation = validateUpload(kind as Kind, file.type, file.size);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const folder = `${kind.toLowerCase()}s`;
  const saved = await storage.save(file, folder);

  return NextResponse.json({
    url: saved.url,
    sizeBytes: saved.sizeBytes,
    mimeType: file.type,
    name: file.name,
  });
}
