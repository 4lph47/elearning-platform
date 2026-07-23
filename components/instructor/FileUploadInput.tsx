"use client";

import { useRef, useState } from "react";
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

// Disparado quando um upload em curso é cancelado por causa de uma nova
// escolha de ficheiro (não é falha nenhuma — não deve aparecer erro nem
// contar pro mecanismo de retry).
class UploadAbortedError extends Error {}

// retryable=true: falha de rede/servidor, vale a pena tentar de novo.
// retryable=false: erro de validação (ficheiro inválido, tipo não
// permitido, etc.) — repetir não muda nada, mostra logo o erro.
class UploadError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

type XhrRef = React.MutableRefObject<XMLHttpRequest | null>;

// fetch() não expõe progresso de upload (só de download) — XHR continua a
// ser o único jeito nativo de saber quantos bytes já saíram.
function uploadWithProgress(
  formData: FormData,
  xhrRef: XhrRef,
  onProgress: (percent: number) => void
): Promise<{ ok: boolean; data: UploadResult & { error?: string } }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
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
    xhr.onabort = () => reject(new UploadAbortedError());
    xhr.send(formData);
  });
}

// Documento/trailer vão pelo SDK oficial do Supabase (uploadToSignedUrl),
// que não expõe um jeito de abortar um envio a meio — só documentos/
// trailers (bem mais pequenos que vídeo) passam por aqui, por isso não
// vale o esforço de reescrever isto à mão só pra ganhar abort de verdade;
// o generationRef em handleChange já garante que o resultado de um envio
// substituído é ignorado, mesmo que continue em curso.
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

interface WorkerAuth {
  uploadUrl: string;
  token: string;
}

async function authorizeWorkerUpload(file: File): Promise<WorkerAuth> {
  const authRes = await fetch("/api/upload/authorize-direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
  });
  const auth = await authRes.json().catch(() => ({}));
  if (!authRes.ok) throw new UploadError(auth.error ?? "Erro ao preparar envio", authRes.status >= 500);
  return auth;
}

// Pergunta ao worker quantos bytes já tem deste upload — chamado antes de
// cada bloco (não só nos retries), pra nunca depender só da contagem local:
// se um bloco falhar a meio, o ficheiro no worker pode ter ficado com mais
// (ou menos) bytes do que o cliente esperava, e é isto que resincroniza.
async function getReceivedBytes(auth: WorkerAuth): Promise<number> {
  try {
    const res = await fetch(`${auth.uploadUrl}/upload-status`, { headers: { Authorization: `Bearer ${auth.token}` } });
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data.receivedBytes === "number" ? data.receivedBytes : 0;
  } catch {
    return 0;
  }
}

// Tamanho de cada bloco enviado ao worker — em vez de um único pedido HTTP
// a cobrir o upload inteiro (minutos, em vídeos grandes; mostrou-se
// vulnerável a resets de ligação a meio, fora do nosso controlo), o vídeo
// vai em blocos deste tamanho, cada um o seu próprio pedido curto. Um reset
// a meio custa no máximo este bloco, não o envio todo.
const CHUNK_BYTES = 50 * 1024 * 1024;

// Envia um único bloco começando em `offset`. Resolve com o receivedBytes
// que o worker confirma ter guardado (não assume — usa a resposta como
// fonte da verdade pro próximo bloco).
function postChunk(
  auth: WorkerAuth,
  blob: Blob,
  offset: number,
  xhrRef: XhrRef,
  onProgress: (bytesSentInBlock: number) => void
): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", `${auth.uploadUrl}/upload-chunk`);
    xhr.setRequestHeader("Authorization", `Bearer ${auth.token}`);
    xhr.setRequestHeader("X-Upload-Offset", String(offset));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { receivedBytes: number };
          resolve(data.receivedBytes);
        } catch {
          reject(new UploadError("Resposta inválida do worker", true));
        }
      } else {
        let message = "Erro ao enviar vídeo";
        try {
          message = JSON.parse(xhr.responseText).error ?? message;
        } catch {
          // resposta não-JSON (ex.: proxy/erro de rede a meio) — mensagem genérica já chega
        }
        // 5xx (worker/proxy com problema momentâneo), 401 (token expirado)
        // e 409 (offset desatualizado — resincroniza sozinho no próximo
        // bloco) valem retry; 4xx de validação não, repetir não muda nada.
        reject(new UploadError(message, xhr.status >= 500 || xhr.status === 401 || xhr.status === 409));
      }
    };
    xhr.onerror = () => reject(new UploadError("Falha de rede ao enviar bloco", true));
    // Disparado por xhrRef.current?.abort() lá em baixo, quando se escolhe
    // um ficheiro novo enquanto este ainda estava a enviar — corta a
    // ligação na hora, não é um erro de rede, não deve tentar outra vez.
    xhr.onabort = () => reject(new UploadAbortedError());
    xhr.send(blob);
  });
}

// Dispara a compressão sobre o que já foi recebido — pedido sem corpo, só
// fica aberto durante a compressão em si (não durante o envio do vídeo).
function postFinalize(auth: WorkerAuth, totalBytes: number, xhrRef: XhrRef): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", `${auth.uploadUrl}/upload-finalize`);
    xhr.setRequestHeader("Authorization", `Bearer ${auth.token}`);
    xhr.setRequestHeader("X-Total-Bytes", String(totalBytes));
    xhr.onload = () => {
      console.log(`[upload] resposta da finalização: status=${xhr.status} body=`, xhr.responseText.slice(0, 500));
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { hlsMasterUrl: string };
          resolve(data.hlsMasterUrl);
        } catch {
          reject(new UploadError("Resposta inválida do worker", true));
        }
      } else {
        let message = "Erro ao comprimir vídeo";
        try {
          message = JSON.parse(xhr.responseText).error ?? message;
        } catch {
          // resposta não-JSON — mensagem genérica já chega
        }
        reject(new UploadError(message, xhr.status >= 500 || xhr.status === 401 || xhr.status === 409));
      }
    };
    xhr.onerror = () => reject(new UploadError("Falha de rede ao comprimir vídeo", true));
    xhr.onabort = () => reject(new UploadAbortedError());
    xhr.send();
  });
}

const CHUNK_RETRY_ATTEMPTS = 3;
const FINALIZE_RETRY_ATTEMPTS = 2;

async function withUploadRetries<T>(
  fn: () => Promise<T>,
  attempts: number,
  onRetry: (attempt: number, maxAttempts: number) => void
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof UploadAbortedError) throw err;
      lastErr = err;
      const retryable = err instanceof UploadError ? err.retryable : true;
      if (!retryable || attempt === attempts) throw err;
      console.warn(`[upload] tentativa ${attempt} falhou, a repetir:`, err);
      onRetry(attempt + 1, attempts);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

// Autoriza uma vez só (mesmo token/assetId reaproveitado em todos os blocos
// — é o que liga o próximo bloco ao ficheiro parcial já recebido) e envia o
// vídeo em blocos de CHUNK_BYTES, resincronizando com /upload-status antes
// de cada um. Um reset de rede a meio de um bloco só perde esse bloco, não
// o envio todo. Depois de todos os bytes enviados, finaliza (compressão)
// numa chamada à parte, com o seu próprio retry.
async function uploadToWorker(
  file: File,
  xhrRef: XhrRef,
  onProgress: (percent: number) => void,
  onPhaseChange: (phase: "uploading" | "compressing") => void,
  onRetry: (attempt: number, maxAttempts: number) => void
): Promise<UploadResult> {
  const auth = await authorizeWorkerUpload(file);

  let offset = 0;
  while (offset < file.size) {
    offset = await withUploadRetries(
      async () => {
        const actualOffset = await getReceivedBytes(auth);
        const blob = file.slice(actualOffset, actualOffset + CHUNK_BYTES);
        if (actualOffset > 0) console.log(`[upload] a continuar a partir de ${actualOffset}/${file.size} bytes`);
        return postChunk(auth, blob, actualOffset, xhrRef, (bytesSentInBlock) =>
          onProgress(Math.round(((actualOffset + bytesSentInBlock) / file.size) * 100))
        );
      },
      CHUNK_RETRY_ATTEMPTS,
      onRetry
    );
  }

  onPhaseChange("compressing");
  const url = await withUploadRetries(() => postFinalize(auth, file.size, xhrRef), FINALIZE_RETRY_ATTEMPTS, onRetry);
  return { url, sizeBytes: file.size, name: file.name, mimeType: file.type };
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
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  // Cada handleChange ganha o próximo número — um resultado (sucesso, erro,
  // progresso) só mexe no estado se ainda for da tentativa mais recente.
  // Sem isto, escolher um ficheiro novo a meio doutro envio podia deixar a
  // UI a mostrar o resultado do envio ANTIGO a chegar depois do novo já ter
  // começado.
  const generationRef = useRef(0);

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

    // Havia um envio em curso? Corta-o JÁ, assim que se escolhe o próximo
    // ficheiro — não espera nenhum clique extra nem resposta do servidor.
    xhrRef.current?.abort();
    xhrRef.current = null;
    const myGeneration = ++generationRef.current;
    const isCurrent = () => generationRef.current === myGeneration;

    setUploading(true);
    setProgress(0);
    setCompressing(false);
    setRetryInfo(null);
    setError(null);
    setUploadedName(null);

    try {
      if (DIRECT_TO_WORKER_KINDS.includes(kind)) {
        const data = await uploadToWorker(
          file,
          xhrRef,
          (percent) => isCurrent() && setProgress(percent),
          (phase) => isCurrent() && setCompressing(phase === "compressing"),
          (attempt, max) => {
            if (!isCurrent()) return;
            setCompressing(false);
            setRetryInfo({ attempt, max });
          }
        );
        if (!isCurrent()) return;
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
        if (!isCurrent()) return;
        setUploading(false);
        setIndeterminate(false);
        setUploadedName(data.name);
        onUploaded(data);
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      const { ok, data } = await uploadWithProgress(formData, xhrRef, (percent) => isCurrent() && setProgress(percent));
      if (!isCurrent()) return;
      setUploading(false);

      if (!ok) {
        setError(data.error ?? "Erro ao enviar ficheiro");
        return;
      }

      setUploadedName(data.name);
      onUploaded(data);
    } catch (err) {
      if (!isCurrent() || err instanceof UploadAbortedError) return;
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
