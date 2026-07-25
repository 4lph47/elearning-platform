// Legendas automáticas: transcrição corre INTEIRAMENTE no browser do
// instrutor (transformers.js + Whisper, WebAssembly) no momento do upload —
// sem custo de API, sem tocar no worker do Railway (já sujeito a OOM a
// 1080p, ver worker/index.js). Troca: o browser do instrutor gasta CPU a
// transcrever, mais lento que uma API dedicada, mas gratuito e isolado do
// resto da infraestrutura.
//
// @huggingface/transformers carrega-se dum CDN em runtime (import() com
// webpackIgnore), NÃO como dependência npm normal — o pacote tem uma
// variante Node (transformers.node.mjs) que arrasta binários nativos do
// onnxruntime-node (um .node por plataforma) e código ESM com import.meta;
// o webpack tenta sempre bundlar/fazer parse disto ao compilar o SSR do
// componente "use client" que usa isto (mesmo nunca sendo chamado do lado
// do servidor), e nenhuma combinação de serverComponentsExternalPackages/
// aliases resolveu de forma limpa. Import por URL com webpackIgnore é
// invisível ao bundler — o próprio browser é que resolve o import() em
// runtime, tal como faz para o pacote em qualquer app transformers.js.
const TRANSFORMERS_CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";

export type CaptionsPhase = "loading-model" | "decoding-audio" | "transcribing";

interface WhisperChunk {
  text: string;
  timestamp: [number, number | null];
}

// Whisper espera áudio mono a 16kHz — um OfflineAudioContext construído com
// esse sample rate e 1 canal já faz o resample E o downmix (estéreo->mono)
// automaticamente ao renderizar, não é preciso fazer isso à mão.
async function decodeAudioFromFile(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const probeCtx = new AudioContextCtor();
  let decoded: AudioBuffer;
  try {
    decoded = await probeCtx.decodeAudioData(arrayBuffer);
  } finally {
    await probeCtx.close();
  }

  const targetSampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetSampleRate), targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

function formatVttTimestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function chunksToVtt(chunks: WhisperChunk[]): string {
  const lines = ["WEBVTT", ""];
  for (const chunk of chunks) {
    const [start, endRaw] = chunk.timestamp;
    // O último chunk às vezes chega sem fim definido (transcrição cortada
    // a meio de frase) — estimativa curta em vez de deixar a legenda sem
    // hora de saída.
    const end = endRaw ?? start + 3;
    const text = chunk.text.trim();
    if (!text) continue;
    lines.push(`${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}`);
    lines.push(text);
    lines.push("");
  }
  return lines.join("\n");
}

// Modelo "base" (não o "tiny") — melhor precisão em português a um custo de
// CPU ainda razoável para correr no browser de quem está a fazer upload.
const MODEL_ID = "Xenova/whisper-base";

// As duas falhas vistas até agora neste carregamento (ERR_HTTP2_PROTOCOL_ERROR,
// "Failed to fetch") são de rede/CDN a meio de um download de ~77MB — não
// falhas permanentes. Teto de tentativas de propósito (ao contrário do
// upload de vídeo): se o erro NÃO for de rede mas sim permanente (ex.: o
// bug do q4 já visto antes), repetir pra sempre nunca ia conseguir, e sem
// teto não dava pra distinguir "ainda a tentar" de "preso".
async function withRetries<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function transcribeFileToVtt(file: File, onProgress?: (phase: CaptionsPhase) => void): Promise<string> {
  onProgress?.("loading-model");
  const { pipeline } = await import(/* webpackIgnore: true */ TRANSFORMERS_CDN_URL);
  // Bug conhecido do runtime v4 do onnxruntime-web (huggingface/
  // transformers.js#1707): o otimizador novo reescreve o padrão QDQ em
  // MatMulNBits e passa a exigir um scale tensor que os ficheiros
  // quantizados (q4 E q8) do DECODER deste modelo não têm — exportados
  // antes desse runtime existir ("Can't create a session... Missing
  // required scale: model.decoder.embed_tokens.weight_merged_0_scale").
  // Sem fix do lado da HF, só fp32 no decoder carrega. Encoder fica em q8
  // (esse não tem o problema, poupa download) — total ainda uns 232MB
  // (23.2MB + 209MB), por isso o retry acima importa: um download deste
  // tamanho não é imune a um ERR_HTTP2_PROTOCOL_ERROR a meio.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transcriber = await withRetries<any>(
    () =>
      pipeline("automatic-speech-recognition", MODEL_ID, {
        dtype: { encoder_model: "q8", decoder_model_merged: "fp32" },
      }),
    3
  );

  onProgress?.("decoding-audio");
  const audio = await decodeAudioFromFile(file);

  onProgress?.("transcribing");
  const output = (await transcriber(audio, {
    language: "portuguese",
    task: "transcribe",
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  })) as unknown;

  const result = Array.isArray(output) ? output[0] : output;
  const chunks = ((result as { chunks?: WhisperChunk[] } | undefined)?.chunks ?? []) as WhisperChunk[];
  return chunksToVtt(chunks);
}

export async function uploadCaptionsVtt(vttText: string): Promise<{ url: string; name: string }> {
  const file = new File([vttText], "legendas.vtt", { type: "text/vtt" });
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", "CAPTIONS");
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao enviar legendas");
  return { url: data.url, name: data.name };
}
