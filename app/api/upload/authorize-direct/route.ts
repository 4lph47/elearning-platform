import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "node:crypto";
import { authOptions } from "@/lib/auth";
import { validateUpload } from "@/lib/validations";

export const runtime = "nodejs";

// Vídeo: em vez de subir bruto pro Supabase Storage (trava em 50MB por
// objeto no plano Free) e só comprimir depois, o browser envia diretamente
// pro worker (Railway, sem esse limite) — este endpoint só assina um token
// de curta duração autorizando esse envio, o worker valida-o sozinho (mesmo
// segredo partilhado que já protege /api/worker/jobs/*, ver
// worker/index.js:verifyUploadToken). Nada do vídeo passa por aqui.
const TOKEN_TTL_MS = 30 * 60 * 1000;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const workerSecret = process.env.WORKER_API_SECRET;
  let workerUrl = process.env.WORKER_PUBLIC_URL;
  if (!workerSecret || !workerUrl) {
    return NextResponse.json({ error: "Worker de compressão não está configurado" }, { status: 503 });
  }
  // Erro fácil de cometer ao colar o domínio do Railway (a UI deles não
  // mostra o "https://" por defeito) — sem protocolo, `${workerUrl}/upload`
  // vira um URL relativo no browser em vez de apontar pro worker, e falha
  // silenciosamente como 404 dentro da própria app. Normaliza sempre.
  workerUrl = workerUrl.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(workerUrl)) {
    workerUrl = `https://${workerUrl}`;
  }

  const body = await request.json();
  const { mimeType, sizeBytes, assetId: clientFingerprint } = body as {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    assetId?: string;
  };
  if (typeof mimeType !== "string" || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Dados de envio inválidos" }, { status: 400 });
  }
  const validation = validateUpload("VIDEO", mimeType, sizeBytes);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // O fingerprint (nome+tamanho+data de modificação do ficheiro) que o
  // cliente manda não é segredo — dois instrutores diferentes a enviar um
  // ficheiro com o mesmo nome/tamanho/data batiam no mesmo assetId no
  // worker e podiam ver/retomar o parcial um do outro. Namespacing com o
  // id da PRÓPRIA sessão (nunca um id vindo do pedido) resolve isto: só dá
  // pra chegar a este assetId final autenticado como este utilizador.
  const isValidFingerprint = typeof clientFingerprint === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(clientFingerprint);
  const assetId = isValidFingerprint
    ? crypto.createHash("sha256").update(`${session.user.id}:${clientFingerprint}`).digest("hex")
    : crypto.randomUUID();
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${assetId}.${expiresAt}`;
  const signature = crypto.createHmac("sha256", workerSecret).update(payload).digest("hex");
  const token = `${payload}.${signature}`;

  // Base do worker — o cliente monta /upload-chunk, /upload-finalize e
  // /upload-status a partir daqui (ver FileUploadInput.tsx).
  return NextResponse.json({ uploadUrl: workerUrl, token, assetId });
}
