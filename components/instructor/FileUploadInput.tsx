"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Kind = "VIDEO" | "TRAILER" | "DOCUMENT" | "IMAGE";

const ACCEPT: Record<Kind, string> = {
  VIDEO: "video/mp4,video/webm",
  TRAILER: "video/mp4,video/webm",
  DOCUMENT: "application/pdf",
  IMAGE: "image/png,image/jpeg,image/webp",
};

// Documento e trailer de curso vão direto pro Supabase Storage (ver
// /api/upload/sign) — nunca passam pelo corpo de um pedido ao Vercel, que
// tem um limite de 4.5MB nas serverless functions. Trailer fica neste
// caminho (não vai pro worker/HLS como vídeo de aula) porque o
// hover-preview do curso (CourseTile.tsx) usa <video> simples, sem
// hls.js. Imagens continuam a ir por app/api/upload — precisam de passar
// por lá para o sharp comprimir.
const DIRECT_UPLOAD_KINDS: Kind[] = ["DOCUMENT", "TRAILER"];

// Vídeo vai direto pro worker (Railway), não pro Supabase Storage — o
// worker comprime pra HLS ANTES de qualquer coisa tocar o Storage (só as
// renditions finais, pequenas, lá chegam). Isto evita de vez o teto de
// 50MB por objeto do Supabase Free (que rejeitava qualquer vídeo real
// enviado bruto) sem precisar de partir o ficheiro em pedaços — o worker,
// ao contrário do Vercel/Supabase, não tem esse limite.
const DIRECT_TO_WORKER_KINDS: Kind[] = ["VIDEO"];

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

// retryable=true: falha de rede/servidor, vale a pena tentar de novo do
// zero. retryable=false: erro de validação (ficheiro inválido, tipo não
// permitido, etc.) — repetir não muda nada, mostra logo o erro.
class UploadError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

// Envia o vídeo bruto diretamente pro worker (Railway) via um token de
// upload de curta duração (ver /api/upload/authorize-direct). A resposta só
// volta quando a escada HLS toda estiver pronta — onPhaseChange avisa a UI
// para trocar a barra de progresso (percentagem, enquanto os bytes ainda
// estão a sair) por um indicador indeterminado (enquanto o worker comprime,
// sem progresso conhecido).
function uploadToWorkerOnce(
  file: File,
  onProgress: (percent: number) => void,
  onPhaseChange: (phase: "uploading" | "compressing") => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    fetch("/api/upload/authorize-direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
    })
      .then(async (authRes) => {
        const auth = await authRes.json().catch(() => ({}));
        if (!authRes.ok) {
          throw new UploadError(auth.error ?? "Erro ao preparar envio", authRes.status >= 500);
        }

        console.log("[upload] a enviar pro worker:", auth.uploadUrl);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", auth.uploadUrl);
        xhr.setRequestHeader("Authorization", `Bearer ${auth.token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.upload.onload = () => onPhaseChange("compressing");
        xhr.onload = () => {
          console.log(`[upload] resposta do worker: status=${xhr.status} body=`, xhr.responseText.slice(0, 500));
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as { hlsMasterUrl: string };
              resolve({ url: data.hlsMasterUrl, sizeBytes: file.size, name: file.name, mimeType: file.type });
            } catch {
              reject(new UploadError("Resposta inválida do worker", true));
            }
          } else {
            let message = "Erro ao comprimir vídeo";
            try {
              message = JSON.parse(xhr.responseText).error ?? message;
            } catch {
              // resposta não-JSON (ex.: proxy/erro de rede a meio) — mensagem genérica já chega
            }
            // 5xx (worker/proxy com problema momentâneo) e 401 (token
            // expirado — cada tentativa pede um token novo) valem retry;
            // 4xx de validação não, repetir não muda o resultado.
            reject(new UploadError(message, xhr.status >= 500 || xhr.status === 401));
          }
        };
        xhr.onerror = () => {
          console.error(`[upload] falha de rede — readyState=${xhr.readyState} status=${xhr.status}`);
          reject(new UploadError("Falha de rede ao enviar para compressão", true));
        };
        xhr.send(file);
      })
      .catch((err) => reject(err instanceof UploadError ? err : new UploadError("Falha de rede", true)));
  });
}

const UPLOAD_RETRY_ATTEMPTS = 3;

// Retenta o envio TODO do zero (não há resumo por bytes — só reenvia o
// ficheiro inteiro outra vez) quando a falha é de rede/servidor. Ficheiros
// grandes deviam evitar isto (é caro repetir do zero), mas continua a ser
// muito melhor que obrigar a pessoa a repetir à mão — e a maior parte das
// quebras de rede são momentâneas, resolvem-se numa 2ª tentativa.
async function uploadToWorker(
  file: File,
  onProgress: (percent: number) => void,
  onPhaseChange: (phase: "uploading" | "compressing") => void,
  onRetry: (attempt: number, maxAttempts: number) => void
): Promise<UploadResult> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
    try {
      return await uploadToWorkerOnce(file, onProgress, onPhaseChange);
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof UploadError ? err.retryable : true;
      if (!retryable || attempt === UPLOAD_RETRY_ATTEMPTS) throw err;
      console.warn(`[upload] tentativa ${attempt} falhou, a repetir:`, err);
      onRetry(attempt + 1, UPLOAD_RETRY_ATTEMPTS);
      onProgress(0);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

const KIND_LABEL: Record<Kind, string> = {
  VIDEO: "Vídeo",
  TRAILER: "Trailer",
  DOCUMENT: "Documento",
  IMAGE: "Imagem",
};

export function FileUploadInput({
  kind,
  currentUrl,
  currentName,
  onUploaded,
}: {
  kind: Kind;
  // Se o URL já existente não tiver nome (ex.: nunca foi guardado no
  // rascunho, ou é conteúdo antigo de antes desta prop existir), mostra-se
  // só uma confirmação genérica em vez de nada.
  currentUrl?: string | null;
  currentName?: string | null;
  onUploaded: (result: UploadResult) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [indeterminate, setIndeterminate] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; max: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Sempre limpa já — o browser não dispara onChange outra vez se
    // voltares a escolher o MESMO ficheiro (o valor do input não muda),
    // então depois de um erro (rede, ficheiro corrompido, o que for) ficava
    // preso sem reagir a nada até dar refresh à página inteira. Limpar
    // aqui, antes de qualquer erro possível, garante que a próxima escolha
    // — mesmo ficheiro ou outro — dispara sempre onChange de novo.
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setCompressing(false);
    setRetryInfo(null);
    setError(null);

    try {
      if (DIRECT_TO_WORKER_KINDS.includes(kind)) {
        const data = await uploadToWorker(
          file,
          setProgress,
          (phase) => setCompressing(phase === "compressing"),
          (attempt, max) => {
            setCompressing(false);
            setRetryInfo({ attempt, max });
          }
        );
        setUploading(false);
        setCompressing(false);
        setRetryInfo(null);
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
      setCompressing(false);
      setRetryInfo(null);
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
            {indeterminate || compressing ? (
              <div className="h-full w-full animate-pulse rounded-full bg-blue-600" />
            ) : (
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {retryInfo
              ? `Falhou, a tentar de novo (${retryInfo.attempt}/${retryInfo.max})...`
              : compressing
                ? "A comprimir vídeo..."
                : indeterminate
                  ? "A enviar..."
                  : `A enviar (${progress}%)`}
          </p>
        </div>
      )}
      {uploadedName && !uploading && (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Enviado: {uploadedName}</p>
      )}
      {!uploadedName && !uploading && currentUrl && (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          {currentName ? `Enviado: ${currentName}` : `${KIND_LABEL[kind]} já anexado.`}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
