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

async function uploadDirect(kind: Kind, file: File): Promise<UploadResult> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
  });
  const signData = await signRes.json();
  if (!signRes.ok) throw new Error(signData.error ?? "Erro ao preparar envio");

  const { error } = await getSupabaseBrowserClient()
    .storage.from(signData.bucket)
    .uploadToSignedUrl(signData.path, signData.token, file, { contentType: file.type || undefined });
  if (error) throw error;

  return { url: signData.publicUrl, sizeBytes: file.size, name: file.name, mimeType: file.type };
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
