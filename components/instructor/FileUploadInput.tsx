"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Kind = "VIDEO" | "DOCUMENT" | "IMAGE";

const ACCEPT: Record<Kind, string> = {
  VIDEO: "video/mp4,video/webm",
  DOCUMENT: "application/pdf",
  IMAGE: "image/png,image/jpeg,image/webp",
};

// Vídeo/documento vão direto pro Supabase Storage (ver /api/upload/sign) —
// nunca passam pelo corpo de um pedido ao Vercel, que tem um limite de
// 4.5MB nas serverless functions e rejeitava qualquer vídeo real antes
// sequer de chegar ao nosso código (dava "Resposta inválida do servidor",
// porque a resposta de erro do Vercel nem é JSON). Imagens continuam a ir
// por app/api/upload — precisam de passar por lá para o sharp comprimir.
const DIRECT_UPLOAD_KINDS: Kind[] = ["VIDEO", "DOCUMENT"];

// O bucket Supabase trava em 50MB por objeto (plano Free, sem exceção — nem
// upgrade de código dá pra contornar isto sozinho). Vídeo pode chegar a
// vários GB, por isso sobe em partes bem abaixo desse teto (ver
// uploadChunked), cada uma um objeto pequeno próprio — o limite por objeto
// deixa de importar, porque nenhuma parte sequer chega perto dele. O worker
// (worker/index.js) descarrega as partes pela ordem certa e reconstitui o
// ficheiro original antes de transcodificar.
const CHUNKED_UPLOAD_KINDS: Kind[] = ["VIDEO"];
const PART_SIZE = 40 * 1024 * 1024;
const PART_RETRIES = 3;

interface UploadResult {
  url: string;
  sizeBytes: number;
  name: string;
  mimeType: string;
}

// fetch() não expõe progresso de upload (só de download) — XHR continua a
// ser o único jeito nativo de saber quantos bytes já saíram.
function uploadWithProgress(
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; data: UploadResult & { error?: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: UploadResult & { error?: string };
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = { error: "Resposta inválida do servidor" } as UploadResult & { error?: string };
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, data });
    };
    xhr.onerror = () => reject(new Error("Falha de rede"));
    xhr.send(formData);
  });
}

async function signUpload(kind: Kind, fileName: string, mimeType: string, sizeBytes: number, part?: { groupId: string; partName: string }) {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind,
      fileName,
      mimeType,
      sizeBytes,
      groupId: part?.groupId,
      partName: part?.partName,
    }),
  });
  const signData = await signRes.json();
  if (!signRes.ok) throw new Error(signData.error ?? "Erro ao preparar envio");
  return signData as { signedUrl: string; token: string; path: string; publicUrl: string; bucket: string };
}

async function putSigned(kind: Kind, fileName: string, blob: Blob, part?: { groupId: string; partName: string }) {
  const mimeType = blob.type || "application/octet-stream";
  const signData = await signUpload(kind, fileName, mimeType, blob.size, part);
  const { error } = await getSupabaseBrowserClient()
    .storage.from(signData.bucket)
    .uploadToSignedUrl(signData.path, signData.token, blob, { contentType: mimeType });
  if (error) throw error;
  return signData;
}

async function withRetries<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function uploadDirect(kind: Kind, file: File): Promise<UploadResult> {
  const signData = await putSigned(kind, file.name, file);
  return { url: signData.publicUrl, sizeBytes: file.size, name: file.name, mimeType: file.type };
}

// Vídeo sobe em partes de PART_SIZE (todas bem abaixo do teto de 50MB do
// bucket), cada uma o seu próprio objeto — depois de todas em cima, sobe um
// manifesto pequeno (lista das partes, pela ordem certa) que passa a ser o
// "ficheiro fonte" para o resto do pipeline (ver worker/index.js, que
// descarrega as partes e reconstitui o ficheiro original antes de
// transcodificar). Cada parte tenta até PART_RETRIES vezes antes de desistir
// — um só soluço de rede não obriga a recomeçar o envio todo do zero.
async function uploadChunked(kind: Kind, file: File, onProgress: (percent: number) => void): Promise<UploadResult> {
  const groupId = crypto.randomUUID();
  const totalParts = Math.max(1, Math.ceil(file.size / PART_SIZE));
  const partUrls: string[] = [];
  let uploadedBytes = 0;

  for (let i = 0; i < totalParts; i++) {
    const start = i * PART_SIZE;
    const end = Math.min(file.size, start + PART_SIZE);
    const blob = file.slice(start, end);
    const partName = `part-${String(i).padStart(4, "0")}.bin`;

    const signData = await withRetries(() => putSigned(kind, partName, blob, { groupId, partName }), PART_RETRIES);
    partUrls.push(signData.publicUrl);
    uploadedBytes += blob.size;
    onProgress(Math.round((uploadedBytes / file.size) * 100));
  }

  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const manifest = { parts: partUrls, ext, mimeType: file.type, sizeBytes: file.size };
  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const manifestSignData = await withRetries(
    () => putSigned(kind, "manifest.json", manifestBlob, { groupId, partName: "manifest.json" }),
    PART_RETRIES
  );

  return { url: manifestSignData.publicUrl, sizeBytes: file.size, name: file.name, mimeType: file.type };
}

export function FileUploadInput({
  kind,
  onUploaded,
}: {
  kind: Kind;
  onUploaded: (result: UploadResult) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [indeterminate, setIndeterminate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      if (CHUNKED_UPLOAD_KINDS.includes(kind)) {
        const data = await uploadChunked(kind, file, setProgress);
        setUploading(false);
        setUploadedName(data.name);
        onUploaded(data);
        return;
      }

      if (DIRECT_UPLOAD_KINDS.includes(kind)) {
        // uploadToSignedUrl (SDK oficial, sem adivinhar o protocolo do
        // Supabase à mão) usa fetch por baixo — sem evento de progresso,
        // por isso barra indeterminada em vez de percentagem aqui.
        setIndeterminate(true);
        const data = await uploadDirect(kind, file);
        setUploading(false);
        setIndeterminate(false);
        setUploadedName(data.name);
        onUploaded(data);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      const { ok, data } = await uploadWithProgress(formData, setProgress);
      setUploading(false);

      if (!ok) {
        setError(data.error ?? "Erro ao enviar ficheiro");
        return;
      }

      setUploadedName(data.name);
      onUploaded(data);
    } catch (err) {
      setUploading(false);
      setIndeterminate(false);
      setError(err instanceof Error ? err.message : "Erro ao enviar ficheiro");
    }
  }

  return (
    <div>
      <input
        type="file"
        accept={ACCEPT[kind]}
        onChange={handleChange}
        disabled={uploading}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-white/10 dark:file:text-slate-200 dark:hover:file:bg-white/15"
      />
      {uploading && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            {indeterminate ? (
              <div className="h-full w-full animate-pulse rounded-full bg-blue-600" />
            ) : (
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            A enviar{indeterminate ? "..." : ` (${progress}%)`}
          </p>
        </div>
      )}
      {uploadedName && !uploading && (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Enviado: {uploadedName}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
