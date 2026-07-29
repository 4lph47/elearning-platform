"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui/Button";

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
  // Só vem preenchido pra kind="VIDEO" — o worker gera as legendas a
  // seguir à compressão (ver worker/index.js:transcribeToVtt). null se a
  // transcrição falhou (a aula fica sem legendas, mas o vídeo em si já
  // está pronto — não é motivo pra falhar o upload todo).
  captionsUrl?: string | null;
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
  assetId: string;
}

// O que basta pra retomar uma compressão em curso sem o ficheiro original
// (ver PendingVideoUpload em LessonEditScreen.tsx) — guardado no rascunho
// assim que a compressão arranca, limpo quando acaba (sucesso ou falha
// definitiva). totalBytes/fileName só servem pra reconstruir o
// UploadResult no fim, o worker já tem os bytes todos há muito.
export interface ResumableFinalize {
  assetId: string;
  token: string;
  uploadUrl: string;
  totalBytes: number;
  fileName: string;
}

// Deriva um assetId sempre igual pro mesmo ficheiro (nome+tamanho+data de
// modificação) — é o que permite reconhecer "é o mesmo vídeo" mesmo que a
// pessoa o volte a escolher do zero (novo handleChange, sem nenhum estado
// em memória sobrevivente de uma tentativa anterior, incluindo depois de
// um refresh à página). O worker guarda o parcial em disco por assetId (ver
// uploadWorkDir em worker/index.js) — mesmo assetId encontra o mesmo
// ficheiro parcial e resincroniza sozinho a partir de onde ficou.
async function fingerprintAssetId(file: File): Promise<string> {
  const raw = `${file.name}:${file.size}:${file.lastModified}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function authorizeWorkerUpload(file: File): Promise<WorkerAuth> {
  const assetId = await fingerprintAssetId(file);
  const authRes = await fetch("/api/upload/authorize-direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, assetId }),
  });
  const auth = await authRes.json().catch(() => ({}));
  if (!authRes.ok) throw new UploadError(auth.error ?? "Erro ao preparar envio", authRes.status >= 500);
  return auth;
}

// Best-effort: avisa o worker pra matar já o ffmpeg/whisper deste assetId
// (ver /upload-cancel em worker/index.js) em vez de deixá-los terminar
// sozinhos em fundo a comer RAM. keepalive garante que o pedido sai mesmo
// que o componente desmonte logo a seguir (troca de página, etc.); nunca
// bloqueia nem falha visivelmente a UI — se isto não chegar ao worker, o
// pior caso é o job antigo terminar sozinho mais tarde, igual a antes desta
// funcionalidade existir.
export function requestWorkerCancel(auth: { uploadUrl: string; token: string }) {
  fetch(`${auth.uploadUrl}/upload-cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth.token}` },
    keepalive: true,
  }).catch(() => {});
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
// a meio custa no máximo este bloco, não o envio todo — 8MB (não os 50MB de
// antes) também limita a quanto a barra de progresso pode recuar num retry
// (ver clamp em setProgress/setCompressionPercent abaixo) e dá eventos de
// progresso do xhr mais frequentes, sem multiplicar demais os pedidos ao
// worker num vídeo grande.
const CHUNK_BYTES = 8 * 1024 * 1024;

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

// "queued" — job aceite mas ainda à espera de um slot livre no worker (ver
// acquireJobSlot/MAX_CONCURRENT_JOBS em worker/index.js: concorrência
// elástica derivada da RAM do serviço, não um número de uploads simultâneos
// à mão). Sem percentagem nenhuma associada, só "à espera".
type ServerPhase = "queued" | "compressing" | "transcribing";

type FinalizeStatus =
  // hlsMasterUrl aparece já na fase "transcribing" (ver worker/index.js) —
  // vídeo comprimido e pronto, só as legendas (que podem demorar bastante)
  // ainda a caminho.
  | { state: "processing"; phase: ServerPhase; completed: number; total: number | null; hlsMasterUrl?: string }
  | { state: "done"; hlsMasterUrl: string; captionsUrl: string | null }
  | { state: "error"; error: string }
  | { state: "unknown" };

// Só DISPARA a compressão em fundo no worker — não fica à espera dela
// acabar. Um vídeo de ~1h pode levar bem mais que o teto de pedido HTTP da
// própria Railway (15min) só num rung; manter isto aberto até ao fim batia
// nesse teto sempre no mesmo ponto, nunca chegando a terminar (ver
// worker/index.js:startFinalizeJob). O progresso acompanha-se à parte, via
// getFinalizeStatus.
function postFinalizeStart(auth: WorkerAuth, totalBytes: number, xhrRef: XhrRef): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", `${auth.uploadUrl}/upload-finalize`);
    xhr.setRequestHeader("Authorization", `Bearer ${auth.token}`);
    xhr.setRequestHeader("X-Total-Bytes", String(totalBytes));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let message = "Erro ao comprimir vídeo";
      try {
        message = JSON.parse(xhr.responseText).error ?? message;
      } catch {
        // resposta não-JSON — mensagem genérica já chega
      }
      reject(new UploadError(message, xhr.status >= 500 || xhr.status === 401 || xhr.status === 409));
    };
    xhr.onerror = () => reject(new UploadError("Falha de rede ao iniciar compressão", true));
    xhr.onabort = () => reject(new UploadAbortedError());
    xhr.send();
  });
}

// Pedido curto — só consulta o estado, nunca fica à espera da compressão.
function getFinalizeStatus(auth: WorkerAuth, xhrRef: XhrRef): Promise<FinalizeStatus> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("GET", `${auth.uploadUrl}/upload-finalize-status`);
    xhr.setRequestHeader("Authorization", `Bearer ${auth.token}`);
    xhr.onload = () => {
      // 404 == "unknown" (nunca disparou finalize, ou o worker reiniciou a
      // meio e perdeu o estado em memória) — não é erro, o chamador reage
      // repetindo o POST de finalize.
      if (xhr.status === 404) {
        resolve({ state: "unknown" });
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as FinalizeStatus);
        } catch {
          reject(new UploadError("Resposta inválida do worker", true));
        }
        return;
      }
      let message = "Erro ao verificar compressão";
      try {
        message = JSON.parse(xhr.responseText).error ?? message;
      } catch {
        // resposta não-JSON — mensagem genérica já chega
      }
      reject(new UploadError(message, xhr.status >= 500 || xhr.status === 401));
    };
    xhr.onerror = () => reject(new UploadError("Falha de rede ao verificar compressão", true));
    xhr.onabort = () => reject(new UploadAbortedError());
    xhr.send();
  });
}

const FINALIZE_POLL_MS = 4000;

// Dispara a compressão (que encadeia legendas a seguir, ver
// worker/index.js:startFinalizeJob) e depois faz poll do estado até acabar
// (done/error). isCurrent() é checado entre polls — sem isto, escolher um
// ficheiro novo a meio da compressão não tinha nenhum pedido em curso pra
// o xhrRef.abort() cortar (só há pedidos de vez em quando, entre esperas),
// e o poll continuava sozinho em fundo até acabar por conta própria.
async function postFinalize(
  auth: WorkerAuth,
  totalBytes: number,
  xhrRef: XhrRef,
  isCurrent: () => boolean,
  onProgress: (phase: ServerPhase, completed: number, total: number | null) => void,
  // Disparado uma única vez, assim que o worker reporta hlsMasterUrl (fase
  // "transcribing") — deixa o preview trocar já pro player custom (HLS)
  // mesmo com a transcrição (lenta) ainda em curso.
  onHlsReady: (hlsMasterUrl: string) => void
): Promise<{ hlsMasterUrl: string; captionsUrl: string | null }> {
  await postFinalizeStart(auth, totalBytes, xhrRef);
  let hlsReadyFired = false;
  for (;;) {
    await new Promise((r) => setTimeout(r, FINALIZE_POLL_MS));
    if (!isCurrent()) throw new UploadAbortedError();
    const status = await getFinalizeStatus(auth, xhrRef);
    if (status.state === "done") return { hlsMasterUrl: status.hlsMasterUrl, captionsUrl: status.captionsUrl };
    if (status.state === "error") throw new UploadError(status.error, true);
    if (status.state === "unknown") await postFinalizeStart(auth, totalBytes, xhrRef);
    else {
      if (!hlsReadyFired && status.hlsMasterUrl) {
        hlsReadyFired = true;
        onHlsReady(status.hlsMasterUrl);
      }
      onProgress(status.phase, status.completed, status.total);
    }
  }
}

// Atraso entre tentativas — cresce por tentativa mas nunca passa de 15s,
// pra não martelar o worker sem sentido num vídeo que demore a recuperar.
const RETRY_BACKOFF_MS = 1500;
const RETRY_BACKOFF_MAX_MS = 15000;

// Mesmo vídeo, uma única "tentativa" do ponto de vista da pessoa a usar —
// por dentro, falhas de rede/servidor (proxy a resetar a ligação, worker a
// reiniciar, o que for) não gastam um número limitado de tentativas: repete
// para sempre, sempre resincronizando com o worker antes de cada bloco (ver
// getReceivedBytes) pra saber sozinho onde ficou, sem precisar de escolher
// o ficheiro outra vez nem de um teto que acaba por desistir a meio de um
// vídeo grande numa ligação instável. Só para mesmo por erro de validação
// (não vale repetir) ou cancelamento (ficheiro novo escolhido a meio).
async function withUploadRetries<T>(fn: () => Promise<T>, onRetry: () => void): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof UploadAbortedError) throw err;
      const retryable = err instanceof UploadError ? err.retryable : true;
      if (!retryable) throw err;
      console.warn(`[upload] falhou, a repetir a partir de onde ficou:`, err);
      onRetry();
      await new Promise((r) => setTimeout(r, Math.min(RETRY_BACKOFF_MS * attempt, RETRY_BACKOFF_MAX_MS)));
    }
  }
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
  onPhaseChange: (phase: "uploading" | ServerPhase) => void,
  isCurrent: () => boolean,
  onServerProgress: (phase: ServerPhase, completed: number, total: number | null) => void,
  onFinalizePending: (resume: ResumableFinalize | null) => void,
  onHlsReady: (hlsMasterUrl: string) => void,
  onAuth: (auth: WorkerAuth) => void
): Promise<UploadResult> {
  const auth = await authorizeWorkerUpload(file);
  onAuth(auth);
  const noop = () => {};

  let offset = 0;
  while (offset < file.size) {
    offset = await withUploadRetries(async () => {
      const actualOffset = await getReceivedBytes(auth);
      const blob = file.slice(actualOffset, actualOffset + CHUNK_BYTES);
      if (actualOffset > 0) console.log(`[upload] a continuar a partir de ${actualOffset}/${file.size} bytes`);
      return postChunk(auth, blob, actualOffset, xhrRef, (bytesSentInBlock) =>
        onProgress(Math.round(((actualOffset + bytesSentInBlock) / file.size) * 100))
      );
    }, noop);
  }

  onPhaseChange("compressing");
  // A partir daqui já não é preciso o ficheiro original — só o assetId/token
  // guardam o que basta pra retomar isto (ver resumeWorkerFinalize) mesmo
  // que a pessoa feche a aba a meio da compressão/legendas.
  onFinalizePending({
    assetId: auth.assetId,
    token: auth.token,
    uploadUrl: auth.uploadUrl,
    totalBytes: file.size,
    fileName: file.name,
  });
  const { hlsMasterUrl, captionsUrl } = await withUploadRetries(
    () =>
      postFinalize(
        auth,
        file.size,
        xhrRef,
        isCurrent,
        (phase, completed, total) => {
          onPhaseChange(phase);
          onServerProgress(phase, completed, total);
        },
        onHlsReady
      ),
    noop
  );
  return { url: hlsMasterUrl, sizeBytes: file.size, name: file.name, mimeType: file.type, captionsUrl };
}

// Idêntico à cauda de uploadToWorker (a partir da compressão) — só que sem
// nenhum ficheiro nem fase de envio, porque quando isto corre já não há
// ficheiro nenhum (a página foi reaberta): o worker já tinha os bytes todos
// há muito, só falta continuar a acompanhar/retomar a compressão e as
// legendas.
async function resumeWorkerFinalize(
  resume: ResumableFinalize,
  xhrRef: XhrRef,
  isCurrent: () => boolean,
  onPhaseChange: (phase: ServerPhase) => void,
  onServerProgress: (phase: ServerPhase, completed: number, total: number | null) => void,
  onHlsReady: (hlsMasterUrl: string) => void
): Promise<UploadResult> {
  const auth: WorkerAuth = { uploadUrl: resume.uploadUrl, token: resume.token, assetId: resume.assetId };
  const noop = () => {};
  const { hlsMasterUrl, captionsUrl } = await withUploadRetries(
    () =>
      postFinalize(
        auth,
        resume.totalBytes,
        xhrRef,
        isCurrent,
        (phase, completed, total) => {
          onPhaseChange(phase);
          onServerProgress(phase, completed, total);
        },
        onHlsReady
      ),
    noop
  );
  return { url: hlsMasterUrl, sizeBytes: resume.totalBytes, name: resume.fileName, mimeType: "video/mp4", captionsUrl };
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m === 0 ? `${sec}s` : `${m}m ${String(sec).padStart(2, "0")}s`;
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
  onFileSelected,
  compactMobile,
  resumeUpload,
  onFinalizePending,
  onStageChange,
  onEarlyReady,
  onCancelled,
}: {
  kind: Kind;
  // Se o URL já existente não tiver nome (ex.: nunca foi guardado no
  // rascunho, ou é conteúdo antigo de antes desta prop existir), mostra-se
  // só uma confirmação genérica em vez de nada.
  currentUrl?: string | null;
  currentName?: string | null;
  onUploaded: (result: UploadResult) => void;
  // Ficheiro bruto assim que é escolhido, antes de qualquer envio — usado
  // pela geração automática do thumbnail (captureFirstFrame em
  // LessonEditScreen), que corre no browser sobre o MESMO ficheiro
  // original, sem depender do upload/compressão.
  onFileSelected?: (file: File) => void;
  // Espelha o estado interno (uploading/compressing/transcribing, e o % de
  // cada uma quando há) pro pai poder desenhar um indicador de etapas por
  // cima (ver stepper em LessonEditScreen.tsx) — stage null quando não há
  // nenhum envio em curso; percent é sempre null durante "uploading" (o
  // envio já mostra o seu próprio % à parte, ver progress abaixo).
  onStageChange?: (stage: "uploading" | ServerPhase | null, percent: number | null) => void;
  // Em espaços apertados no mobile (ex.: painel de banner com dois
  // uploaders lado a lado), o nome do ficheiro que o próprio browser
  // desenha ao lado do botão nativo não cabe — encolhe o input ao tamanho
  // do botão só até ao breakpoint sm, cortando esse texto pelo overflow
  // (o botão em si, sendo um pseudo-elemento, continua sempre visível).
  compactMobile?: boolean;
  // Compressão em curso duma sessão anterior (rascunho, ver
  // LessonEditScreen.tsx) — se vier preenchido, retoma sozinho no mount,
  // sem esperar nenhuma escolha de ficheiro. Só faz sentido pra kind="VIDEO".
  resumeUpload?: ResumableFinalize | null;
  // Chamado assim que a compressão arranca (guardar no rascunho) e de novo
  // com null quando acaba/falha em definitivo (limpar do rascunho).
  onFinalizePending?: (resume: ResumableFinalize | null) => void;
  // Chamado assim que o worker termina a compressão (vídeo já pronto em
  // HLS), ANTES de as legendas (bem mais lentas) terminarem — deixa o
  // preview trocar já pro player custom em vez de esperar a transcrição
  // toda. onUploaded continua a ser o sinal de "tudo terminado" (com
  // captionsUrl já resolvido). Só faz sentido pra kind="VIDEO".
  onEarlyReady?: (hlsMasterUrl: string) => void;
  // Chamado depois de um cancelamento confirmado — o pai deve repor
  // qualquer preview/estado que tenha adiantado a partir de onFileSelected/
  // onEarlyReady (ver LessonEditScreen.tsx), já que este envio nunca vai
  // chamar onUploaded.
  onCancelled?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [indeterminate, setIndeterminate] = useState(false);
  const [serverPhase, setServerPhase] = useState<ServerPhase | null>(null);
  const [serverPhasePercent, setServerPhasePercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  // Marcado no início de cada tentativa (handleChange e o resume automático)
  // — dá o "decorrido" a partir do relógio real, não de contagem de ticks
  // (sobrevive a abas em fundo, onde setInterval atrasa).
  const startTimeRef = useRef<number | null>(null);
  // uploadUrl/token do worker pra este envio — só existe pra kind="VIDEO"
  // (DIRECT_TO_WORKER_KINDS). Guardado assim que se conhece (authorizeWorkerUpload
  // ou o resumeUpload recebido por prop) pra cancelUpload conseguir avisar o
  // worker (ver requestWorkerCancel) mesmo estando já na fase de compressão/
  // legendas, bem depois do pedido que o obteve ter terminado.
  const workerAuthRef = useRef<{ uploadUrl: string; token: string } | null>(null);
  // Cada handleChange ganha o próximo número — um resultado (sucesso, erro,
  // progresso) só mexe no estado se ainda for da tentativa mais recente.
  // Sem isto, escolher um ficheiro novo a meio doutro envio podia deixar a
  // UI a mostrar o resultado do envio ANTIGO a chegar depois do novo já ter
  // começado.
  const generationRef = useRef(0);

  // Deriva o stage reportado ao pai diretamente do estado interno, em vez de
  // chamar onStageChange em cada ponto que mexe em uploading/serverPhase —
  // um único sítio, nunca desalinha dos dois.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!uploading) onStageChange?.(null, null);
    else onStageChange?.(serverPhase ?? "uploading", serverPhase ? serverPhasePercent : null);
  }, [uploading, serverPhase, serverPhasePercent]);

  // Contador de "decorrido" — lê startTimeRef (marcado no arranque da
  // tentativa) em vez de somar 1s por tick, pra não desviar em abas
  // suspensas pelo browser.
  useEffect(() => {
    if (!uploading) return;
    const tick = () => {
      if (startTimeRef.current) setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [uploading]);

  // Mesmo mecanismo de "abandonar o envio em curso" que já existia pra
  // quando se escolhe um ficheiro novo a meio (ver handleChange) — só que
  // sem escolher nenhum ficheiro. Bump ao generationRef invalida qualquer
  // promise em curso (o catch de handleChange já ignora isCurrent()===false
  // e UploadAbortedError silenciosamente). Também avisa o worker (ver
  // requestWorkerCancel/worker/index.js:/upload-cancel) pra matar já o
  // ffmpeg/whisper deste job em vez de deixá-lo terminar sozinho em fundo a
  // ocupar RAM — importante no plano gratuito do Railway, onde já
  // aconteceram OOMs com dois jobs pesados ao mesmo tempo.
  function cancelUpload() {
    xhrRef.current?.abort();
    xhrRef.current = null;
    generationRef.current++;
    if (workerAuthRef.current) {
      requestWorkerCancel(workerAuthRef.current);
      workerAuthRef.current = null;
    }
    setUploading(false);
    setProgress(0);
    setIndeterminate(false);
    setServerPhase(null);
    setServerPhasePercent(null);
    setError(null);
    setUploadedName(null);
    setElapsedSeconds(0);
    startTimeRef.current = null;
    onFinalizePending?.(null);
    onCancelled?.();
  }

  // Confirmação própria em vez de window.confirm() — caixa nativa do
  // browser, sem nada a ver com o resto da UI da app (mesma razão do card
  // de "Alterações por guardar" em FadeNavContext.tsx).
  const [confirmingCancel, setConfirmingCancel] = useState(false);

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
    onFileSelected?.(file);

    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    setUploading(true);
    setProgress(0);
    setServerPhase(null);
    setServerPhasePercent(null);
    setError(null);
    setUploadedName(null);

    try {
      if (DIRECT_TO_WORKER_KINDS.includes(kind)) {
        const data = await uploadToWorker(
          file,
          xhrRef,
          (percent) => {
            if (!isCurrent()) return;
            // Nunca deixa a barra andar pra trás — num retry (bloco que
            // falhou a meio), o valor confirmado pelo worker pode ser menor
            // que o que já se tinha mostrado (bytes que o browser achava ter
            // enviado mas o servidor não confirmou); fica presa no máximo já
            // visto até apanhar de novo, em vez de recuar visivelmente.
            setProgress((prev) => Math.max(prev, percent));
          },
          (phase) => {
            if (!isCurrent()) return;
            // Muda de fase (compressing -> transcribing) reseta o %, não
            // faz sentido clampar um valor da fase anterior contra o da nova.
            setServerPhase((prev) => {
              if (prev !== phase) setServerPhasePercent(null);
              return phase === "uploading" ? null : phase;
            });
          },
          isCurrent,
          (phase, completed, total) => {
            if (!isCurrent()) return;
            const percent = total ? Math.round((completed / total) * 100) : null;
            setServerPhasePercent((prev) => (percent === null ? prev : prev !== null ? Math.max(prev, percent) : percent));
          },
          (resume) => onFinalizePending?.(resume),
          (hlsMasterUrl) => {
            if (!isCurrent()) return;
            onEarlyReady?.(hlsMasterUrl);
          },
          (auth) => {
            if (!isCurrent()) return;
            workerAuthRef.current = { uploadUrl: auth.uploadUrl, token: auth.token };
          }
        );
        if (!isCurrent()) return;
        workerAuthRef.current = null;
        setUploading(false);
        setServerPhase(null);
        setUploadedName(data.name);
        onFinalizePending?.(null);
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
      setServerPhase(null);
      setServerPhasePercent(null);
      onFinalizePending?.(null);
      setError(err instanceof Error ? err.message : "Erro ao enviar ficheiro");
    }
  }

  // Havia uma compressão em curso doutra sessão (rascunho) quando esta
  // página abriu? Retoma sozinho — sem esperar nenhuma escolha de ficheiro
  // — só acompanhando/continuando o que o worker já tinha (ver
  // resumeWorkerFinalize). Só corre uma vez: se entretanto for escolhido um
  // ficheiro novo à mão, handleChange já aborta e assume via generationRef,
  // tal como cortaria qualquer outro envio em curso.
  useEffect(() => {
    if (!resumeUpload) return;
    const myGeneration = ++generationRef.current;
    const isCurrent = () => generationRef.current === myGeneration;

    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    setUploading(true);
    setServerPhase("compressing");
    setServerPhasePercent(null);
    setError(null);
    workerAuthRef.current = { uploadUrl: resumeUpload.uploadUrl, token: resumeUpload.token };

    resumeWorkerFinalize(
      resumeUpload,
      xhrRef,
      isCurrent,
      (phase) => {
        if (!isCurrent()) return;
        setServerPhase((prev) => {
          if (prev !== phase) setServerPhasePercent(null);
          return phase;
        });
      },
      (phase, completed, total) => {
        if (!isCurrent()) return;
        const percent = total ? Math.round((completed / total) * 100) : null;
        setServerPhasePercent((prev) => (percent === null ? prev : prev !== null ? Math.max(prev, percent) : percent));
      },
      (hlsMasterUrl) => {
        if (!isCurrent()) return;
        onEarlyReady?.(hlsMasterUrl);
      }
    )
      .then((data) => {
        if (!isCurrent()) return;
        workerAuthRef.current = null;
        setUploading(false);
        setServerPhase(null);
        setUploadedName(data.name);
        onFinalizePending?.(null);
        onUploaded(data);
      })
      .catch((err) => {
        if (!isCurrent() || err instanceof UploadAbortedError) return;
        setUploading(false);
        setServerPhase(null);
        setServerPhasePercent(null);
        onFinalizePending?.(null);
        setError(err instanceof Error ? err.message : "Erro ao retomar compressão");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <input
          type="file"
          accept={ACCEPT[kind]}
          onChange={handleChange}
          className={`block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-300 dark:file:bg-white/10 dark:file:text-slate-200 dark:hover:file:bg-white/15 ${
            compactMobile ? "max-w-[132px] overflow-hidden sm:max-w-none sm:overflow-visible" : ""
          }`}
        />
        {uploading && (
          <Button type="button" variant="danger" onClick={() => setConfirmingCancel(true)} className="shrink-0">
            Cancelar
          </Button>
        )}
      </div>
      {uploading && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            {indeterminate || (serverPhase && serverPhasePercent === null) ? (
              <div className="h-full w-full animate-pulse rounded-full bg-blue-600" />
            ) : (
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-150"
                style={{ width: `${serverPhase ? serverPhasePercent : progress}%` }}
              />
            )}
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
            <p className="text-slate-500 dark:text-slate-400">
              {kind === "VIDEO"
                ? // Etapa (enviar/comprimir/legendas) já vem no stepper por
                  // cima (ver LessonEditScreen) — aqui só a percentagem, ou
                  // "A preparar..." enquanto ainda não há nenhuma (extração
                  // de áudio/carregamento do modelo, início do envio, etc.).
                  serverPhase
                  ? serverPhase === "queued"
                    ? "Na fila..."
                    : serverPhasePercent !== null
                      ? `${serverPhasePercent}%`
                      : "A preparar..."
                  : indeterminate
                    ? "A preparar..."
                    : `${progress}%`
                : indeterminate
                  ? "A enviar"
                  : `A enviar (${progress}%)`}
            </p>
            <p className="flex shrink-0 items-baseline gap-1.5 text-slate-400 dark:text-slate-500">
              {(() => {
                const activePercent = serverPhase ? serverPhasePercent : indeterminate ? null : progress;
                const eta =
                  activePercent !== null && activePercent > 0
                    ? Math.round((elapsedSeconds * (100 - activePercent)) / activePercent)
                    : null;
                return (
                  <>
                    <span>{formatDuration(elapsedSeconds)}</span>
                    {eta !== null && (
                      <>
                        <span className="h-3 w-px bg-slate-300 dark:bg-white/15" />
                        <span>{formatDuration(eta)} restante</span>
                      </>
                    )}
                  </>
                );
              })()}
            </p>
          </div>
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
      {confirmingCancel && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setConfirmingCancel(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Cancelar envio</h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
              Tens a certeza? O progresso atual deste envio perde-se.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmingCancel(false)}>
                Voltar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setConfirmingCancel(false);
                  cancelUpload();
                }}
              >
                Cancelar envio
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
