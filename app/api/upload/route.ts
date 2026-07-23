import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import sharp from "sharp";
import { authOptions } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { validateUpload } from "@/lib/validations";

export const runtime = "nodejs";

const ALLOWED_KINDS = ["VIDEO", "DOCUMENT", "IMAGE"] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

// Imagens (thumbnails, avatares, etc.) chegavam ao storage exatamente como
// foram enviadas — uma foto de telemóvel de 4000x3000 servida 1:1 numa
// card de 300x200 desperdiça banda em cada visualização. Redimensionar +
// recomprimir aqui é rápido (milissegundos, CPU só) e corre dentro do
// próprio limite de tempo do Vercel — ao contrário de vídeo, não precisa
// de um worker à parte.
const IMAGE_MAX_DIMENSION = 1920;
const IMAGE_QUALITY = 82;

async function compressImage(file: File): Promise<File> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const compressed = await sharp(buffer)
    .rotate() // aplica a orientação EXIF antes de redimensionar, depois descarta-a
    .resize({ width: IMAGE_MAX_DIMENSION, height: IMAGE_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: IMAGE_QUALITY })
    .toBuffer();
  const newName = file.name.replace(/\.[^./]+$/, "") + ".webp";
  return new File([compressed], newName, { type: "image/webp" });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const formData = await request.formData();
  let file = formData.get("file");
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

  if (kind === "IMAGE") {
    try {
      file = await compressImage(file);
    } catch {
      // Ficheiro corrompido ou formato que o sharp não decodifica — segue
      // com o original em vez de rebentar o upload todo.
    }
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
