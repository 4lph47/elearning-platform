// Worker de transcoding de vídeo — corre fora do Vercel (sem ffmpeg nem
// tempo de execução para isto nas functions serverless), com ffmpeg pra
// gerar HLS (segmentado, várias qualidades) de cada vídeo de aula.
//
// Dois jeitos de chegar aqui:
// 1. Upload direto (normal): o browser envia o vídeo bruto diretamente pra
//    cá, em blocos de tamanho fixo via POST /upload-chunk (autenticado por
//    um token HMAC de curta duração que a app gera — ver
//    app/api/upload/authorize-direct), seguido de POST /upload-finalize que
//    dispara a compressão. Cada bloco é um pedido HTTP curto — evita ter um
//    único pedido a durar o upload inteiro (minutos, em vídeos grandes),
//    que se mostrou vulnerável a resets de ligação a meio (proxy/rede,
//    fora do nosso controlo). Comprime-se ANTES de qualquer coisa tocar o
//    Supabase Storage — só as renditions finais (pequenas) lá chegam, nunca
//    o ficheiro bruto.
// 2. Fila assíncrona (fallback): se alguém colar um URL de vídeo já
//    existente em vez de fazer upload (ver contentUrl em LessonEditScreen),
//    a app cria um VideoTranscodeJob e este worker apanha-o via poll a
//    /api/worker/jobs/next — mesmo pipeline de transcode, só muda de onde
//    vem o ficheiro fonte.
//
// Ver README.md deste diretório para deploy (agora precisa de expor porta —
// deixou de ser só um poller em fundo).

const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const http = require("node:http");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const execFileAsync = promisify(execFile);

const APP_URL = requireEnv("APP_URL");
const WORKER_API_SECRET = requireEnv("WORKER_API_SECRET");
const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SECRET_KEY = requireEnv("SUPABASE_SECRET_KEY");
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "course-media";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 8000;
const UPLOAD_PORT = Number(process.env.PORT) || 8080;
const HLS_SEGMENT_SECONDS = 6;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta a variável de ambiente ${name}`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Retry genérico com backoff — usado nos 3 pontos onde uma falha
// transitória (rede, Supabase, I/O momentâneo) não devia deitar fora um
// upload/compressão já em curso: chamadas à app (apiFetch), upload de
// renditions/master playlist pro Storage, e o próprio ffmpeg.
async function withRetries(fn, attempts, label) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        console.warn(`${label} falhou (tentativa ${i + 1}/${attempts}), a repetir:`, err && err.message ? err.message : err);
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// Do menor pro maior — processado por essa ordem (ver transcodeToHls) para
// ficar reproduzível o mais cedo possível (rung pequeno = rápido de
// codificar). Só se gera uma rendition se o vídeo de origem for pelo menos
// dessa altura (nunca faz upscale).
//
// Teto temporário em 1080p: 1440p/2160p confirmaram SIGKILL (OOM) mesmo já
// com lookahead/threads/ref cortados ao mínimo razoável — é limite real de
// RAM do container do Railway, não parâmetro do ffmpeg. Volta a incluir
// 1440p/2160p aqui assim que os recursos do worker forem aumentados (ver
// worker/README.md).
const QUALITY_LADDER = [
  { label: "480p", height: 480 },
  { label: "720p", height: 720 },
  { label: "1080p", height: 1080 },
];

async function apiFetch(pathname, init) {
  return withRetries(async () => {
    const res = await fetch(`${APP_URL}${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${WORKER_API_SECRET}`,
        "Content-Type": "application/json",
        ...(init && init.headers),
      },
    });
    if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    return res.json();
  }, 3, `apiFetch ${pathname}`);
}

async function claimNextJob() {
  const { job } = await apiFetch("/api/worker/jobs/next");
  return job;
}

async function reportRendition(jobId, rendition, masterPlaylistUrl, final) {
  await apiFetch(`/api/worker/jobs/${jobId}/complete`, {
    method: "POST",
    body: JSON.stringify({ rendition, masterPlaylistUrl, final }),
  });
}

async function failJob(jobId, error) {
  await apiFetch(`/api/worker/jobs/${jobId}/fail`, {
    method: "POST",
    body: JSON.stringify({ error: String(error).slice(0, 2000) }),
  }).catch((e) => console.error(`Falhou a marcar job ${jobId} como FAILED também:`, e));
}

// Só usado pelo caminho de fila assíncrona (fallback) — um URL de vídeo já
// existente, colado à mão (não veio do upload direto).
async function downloadSource(sourceUrl, destPath) {
  await withRetries(async () => {
    const res = await fetch(sourceUrl);
    if (!res.ok || !res.body) throw new Error(`Download da fonte falhou: HTTP ${res.status}`);
    await fs.writeFile(destPath, Buffer.from(await res.arrayBuffer()));
  }, 3, "download da fonte");
}

async function probeDimensions(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=p=0:s=x",
    filePath,
  ]);
  const [width, height] = stdout.trim().split("x").map(Number);
  if (!width || !height) throw new Error(`ffprobe não conseguiu ler dimensões de ${filePath}`);
  return { width, height };
}

async function probeDuration(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    filePath,
  ]);
  const seconds = Number(stdout.trim());
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

// Corre o ffmpeg via spawn (não execFile) — só assim dá pra ler o stdout
// enquanto o processo ainda está a correr. "-progress pipe:1" faz o ffmpeg
// escrever linhas "chave=valor" (out_time=HH:MM:SS.ms entre elas) ali a
// cada fração de segundo; sem isto só saberíamos que um rung acabou
// DEPOIS de acabar (execFile só resolve a promise no fim), sem nada a
// meio. stderr fica ao critério do "-loglevel error" (só erros reais,
// nada de verboso) — guarda-se pra compor a mensagem de erro se o
// processo sair com falha.
function runFfmpeg(args, durationSeconds, onProgress) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    const stderrChunks = [];
    let stdoutBuffer = "";
    proc.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? ""; // última linha pode estar incompleta, guarda pro próximo chunk
      if (!onProgress || !(durationSeconds > 0)) return;
      for (const line of lines) {
        const match = line.match(/^out_time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (!match) continue;
        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
        onProgress(Math.min(1, seconds / durationSeconds));
      }
    });
    proc.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    proc.on("error", reject);
    proc.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const stderr = Buffer.concat(stderrChunks).toString().trim();
      const err = new Error(stderr || `ffmpeg saiu com código ${code}`);
      err.signal = signal;
      reject(err);
    });
  });
}

// HLS segmentado — TODOS os rungs recodificam agora, incluindo o mais
// próximo da fonte (antes ficava só remuxado, "-c copy", do mesmo tamanho
// do original). CRF mais baixo (20, quase sem perda visível) no rung de
// topo, CRF 23 (ainda alta qualidade) nos restantes — troca CPU extra no
// upload por espaço a sério poupado no Storage, mesmo na melhor qualidade.
async function transcodeRenditionHls(sourcePath, outDir, targetHeight, crf, durationSeconds, onProgress) {
  await fs.mkdir(outDir, { recursive: true });
  const playlistPath = path.join(outDir, "index.m3u8");
  const segmentPattern = path.join(outDir, "seg%03d.ts");

  // H.264 continua a ser o único codec com suporte universal (Chrome/Firefox
  // não decodificam HEVC de forma fiável, Safari só suporta AV1 parcialmente
  // — testado antes de decidir, não é suposição). "medium" sozinho ainda
  // estava a levar SIGKILL (OOM confirmado nos logs) a 1080p num container
  // do Railway com pouca RAM — os dois maiores consumidores de memória do
  // x264 são o lookahead (buffer de frames futuras pra decidir bitrate) e o
  // nº de referências; limitam-se os dois diretamente via -x264-params, e
  // -threads 2 evita cada thread duplicar os seus próprios buffers. "fast"
  // em vez de "medium" soma-se a isto — mais uma redução de memória, não só
  // de tempo.
  //
  // -tune fastdecode: desliga CABAC (usa CAVLC), o deblocking filter entre
  // fatias e weighted prediction — troca uma fatia pequena de eficiência de
  // compressão por MUITO menos trabalho pro descodificador do lado de quem
  // vê o vídeo. É o oposto do "preset"/"-x264-params" de cima (esses só
  // poupam RAM/tempo AQUI, na compressão) — isto poupa CPU no aparelho de
  // quem reproduz, que é onde os cortes/pausas a meio do vídeo estavam a
  // acontecer.
  const codecArgs = [
    "-vf",
    `scale=-2:${targetHeight}`,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-tune",
    "fastdecode",
    "-x264-params",
    "rc-lookahead=20:ref=2",
    "-threads",
    "2",
    "-profile:v",
    "high",
    "-crf",
    String(crf),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
  ];

  try {
    // Só 2 tentativas (não 3, como o resto) — um OOM-kill vai continuar OOM
    // a repetir do mesmo jeito, retry só ajuda em falhas de I/O/recursos
    // genuinamente momentâneas, não vale gastar tempo a repetir muito.
    await withRetries(
      () =>
        runFfmpeg(
          [
            "-y",
            "-loglevel",
            "error",
            "-i",
            sourcePath,
            ...codecArgs,
            "-hls_time",
            String(HLS_SEGMENT_SECONDS),
            "-hls_playlist_type",
            "vod",
            "-hls_segment_filename",
            segmentPattern,
            "-progress",
            "pipe:1",
            playlistPath,
          ],
          durationSeconds,
          onProgress
        ),
      2,
      `ffmpeg ${path.basename(outDir)}`
    );
  } catch (err) {
    // err.message do execFile não inclui o sinal que matou o processo —
    // "SIGKILL" sem mais nada no stderr é a assinatura clássica de OOM-kill
    // (o kernel mata o processo sem lhe dar hipótese de reportar erro
    // nenhum). Reconstrói a mensagem com isso incluído, pra não precisar de
    // ir aos logs do Railway pra saber isto da próxima vez.
    const signal = err && err.signal ? ` (sinal: ${err.signal}, provável falta de memória no container)` : "";
    const err2 = new Error(`${(err && err.message) || "ffmpeg falhou"}${signal}`);
    err2.cause = err;
    throw err2;
  }
}

function contentTypeFor(fileName) {
  if (fileName.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (fileName.endsWith(".ts")) return "video/mp2t";
  return "application/octet-stream";
}

// Sobe todos os ficheiros de uma variante (index.m3u8 + segmentos) para
// video-renditions/{key}/{label}/ — "key" é o lessonId (fila assíncrona) ou
// um assetId gerado no momento do upload (upload direto, aula ainda nem
// existe na BD). Devolve o URL público do índice e o total de bytes.
async function uploadRenditionDir(key, label, dirPath) {
  const files = await fs.readdir(dirPath);
  let totalBytes = 0;
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const buffer = await fs.readFile(filePath);
    totalBytes += buffer.byteLength;
    const objectPath = `video-renditions/${key}/${label}/${file}`;
    await withRetries(async () => {
      const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
        contentType: contentTypeFor(file),
        upsert: true,
      });
      if (error) throw error;
    }, 3, `upload Storage ${objectPath}`);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`video-renditions/${key}/${label}/index.m3u8`);
  return { indexUrl: data.publicUrl, totalBytes };
}

async function uploadMasterPlaylist(key, variants) {
  // Ordenado por bandwidth ascendente — convenção HLS, ajuda o player a
  // escolher a variante inicial mais baixa em ligações lentas.
  const sorted = [...variants].sort((a, b) => a.bandwidth - b.bandwidth);
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const v of sorted) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidth},RESOLUTION=${v.width}x${v.height}`);
    lines.push(`${v.label}/index.m3u8`);
  }
  const content = lines.join("\n") + "\n";
  const objectPath = `video-renditions/${key}/master.m3u8`;
  await withRetries(async () => {
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, Buffer.from(content), {
      contentType: "application/vnd.apple.mpegurl",
      upsert: true,
    });
    if (error) throw error;
  }, 3, `upload Storage ${objectPath}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

// Núcleo partilhado pelos dois caminhos (upload direto e fila assíncrona):
// dado um ficheiro já em disco local, gera a escada HLS completa, subindo
// (e reportando, via onRendition) cada rung assim que fica pronto — não só
// no fim. onRendition pode ser null (upload direto não precisa de reportar
// rung a rung, só devolve tudo no fim da resposta HTTP).
// ffmpeg "-vf scale=-2:H" arredonda a largura pro múltiplo de 2 mais
// próximo (exigido por libx264) — reproduz esse arredondamento aqui, pra
// não depender de sondar um segmento .ts com ffprobe pelas dimensões
// (frágil: o 1º segmento pode não ter um keyframe logo à entrada, e
// ffprobe falha a ler as suas dimensões mesmo com o ficheiro válido).
function scaledEvenWidth(sourceWidth, sourceHeight, targetHeight) {
  const width = Math.round((sourceWidth * targetHeight) / sourceHeight);
  return width % 2 === 0 ? width : width - 1;
}

// options.resume / options.persistProgress — só usados pelo caminho de
// upload direto (ver handleUploadFinalizeRequest): retoma rungs já feitos
// numa tentativa de finalize anterior (em vez de recomeçar a escada TODA
// do zero a cada retry) e grava o progresso em disco depois de CADA rung,
// pra um próximo retry poder ler onde ficou. A fila assíncrona não passa
// nada aqui — já tem o próprio checkpointing (reportRendition por job).
async function transcodeToHls(key, sourcePath, workDir, onRendition, options) {
  const resume = options && options.resume;
  const persistProgress = Boolean(options && options.persistProgress);

  const { width: sourceWidth, height: sourceHeight } = await probeDimensions(sourcePath);
  const durationSeconds = await probeDuration(sourcePath);

  let rungs = QUALITY_LADDER.filter((r) => sourceHeight >= r.height * 0.9);
  if (rungs.length === 0) {
    // Fonte mais pequena que o degrau mínimo (480p) — só gera nessa mesma altura.
    rungs = [{ label: `${sourceHeight}p`, height: sourceHeight }];
  }
  if (options && options.onPlan) options.onPlan(rungs.length);

  const doneLabels = new Set((resume && resume.renditions ? resume.renditions : []).map((r) => r.quality));
  const variantsSoFar = resume && resume.variants ? [...resume.variants] : [];
  const renditions = resume && resume.renditions ? [...resume.renditions] : [];
  let masterPlaylistUrl = (resume && resume.masterPlaylistUrl) || null;

  for (let i = 0; i < rungs.length; i++) {
    const rung = rungs[i];
    if (doneLabels.has(rung.label)) {
      console.log(`  -> ${rung.label} já estava pronto (retomado de uma tentativa anterior), a saltar`);
      continue;
    }
    const outDir = path.join(workDir, rung.label);
    // rungs vem do menor pro maior — o último é sempre o de maior qualidade
    // da escada (o mais próximo da fonte), fica com CRF mais baixo.
    const isTopRung = i === rungs.length - 1;
    const crf = isTopRung ? 20 : 23;

    await transcodeRenditionHls(sourcePath, outDir, rung.height, crf, durationSeconds, (fraction) => {
      // i rungs já concluídos (saltados ou processados nesta run) antes
      // deste + fração já codificada deste — dá granularidade de 1% em vez
      // de só "mais um rung inteiro pronto".
      if (options && options.onRungProgress) options.onRungProgress(i + fraction);
    });

    const width = scaledEvenWidth(sourceWidth, sourceHeight, rung.height);
    const height = rung.height;
    const { indexUrl, totalBytes } = await uploadRenditionDir(key, rung.label, outDir);
    const bandwidth = durationSeconds > 0 ? Math.round((totalBytes * 8) / durationSeconds) : 1_000_000;

    variantsSoFar.push({ label: rung.label, width, height, bandwidth });
    masterPlaylistUrl = await uploadMasterPlaylist(key, variantsSoFar);

    const rendition = { quality: rung.label, url: indexUrl, width, height, sizeBytes: totalBytes };
    renditions.push(rendition);
    if (persistProgress) {
      await saveTranscodeProgress(workDir, { renditions, variants: variantsSoFar, masterPlaylistUrl });
    }
    const isLast = i === rungs.length - 1;
    if (onRendition) await onRendition(rendition, masterPlaylistUrl, isLast, renditions.length);

    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
    console.log(`  -> ${rung.label} pronto (${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
  }

  return { renditions, masterPlaylistUrl };
}

// --- Legendas automáticas (Whisper, corre AQUI no worker) --------------
//
// Antes corria no browser do instrutor (transformers.js + WASM, ver git log
// de lib/captions.ts) — de propósito, pra não tocar no worker (já sujeito a
// OOM a 1080p, ver QUALITY_LADDER acima). Passou pra cá a pedido: o modelo
// (~232MB) deixa de ser descarregado do CDN em CADA upload (um por
// instrutor, por sessão de browser) — corre 1x por vídeo aqui, com os
// pesos em cache local em disco (transformers.js/onnxruntime-node já
// cacheiam por omissão em Node, ao contrário do browser), só o 1º vídeo
// desde que o container arrancou paga o download do CDN.
//
// Corre DEPOIS de transcodeToHls terminar (nunca em paralelo com o
// ffmpeg) — de propósito: o worker só tem 2GB de RAM, já apertado só com o
// ffmpeg a 1080p (ver comentário no QUALITY_LADDER). getTranscriber() NÃO
// fica cacheado entre vídeos (ao contrário do padrão "singleton" óbvio) —
// carrega-se e descarta-se (transcriber.dispose()) a cada vídeo, pra não
// ocupar ~300-400MB de RAM PERMANENTEMENTE e reduzir a margem que o
// PRÓXIMO vídeo tem pra comprimir. Falha aqui nunca derruba o upload —
// vídeo/compressão já são o caminho crítico, a aula só fica sem legendas
// (ver catch em startFinalizeJob).
const WHISPER_MODEL_ID = "Xenova/whisper-base";
const CAPTION_CHUNK_SECONDS = 30;
const CAPTION_SAMPLE_RATE = 16000;

async function getTranscriber() {
  const { pipeline } = await import("@huggingface/transformers");
  // Mesma config de dtype usada no browser (encoder q8, decoder fp32) — é o
  // que evita o bug conhecido do runtime v4 do onnxruntime (MatMulNBits a
  // exigir um scale tensor que os ficheiros quantizados do decoder deste
  // modelo não têm, ver huggingface/transformers.js#1707). Não confirmado
  // se o mesmo bug existe no onnxruntime-node (motor diferente do
  // onnxruntime-web), mas é a config já comprovada a carregar sem falhar
  // para este modelo exato, por isso reutiliza-se.
  return pipeline("automatic-speech-recognition", WHISPER_MODEL_ID, {
    dtype: { encoder_model: "q8", decoder_model_merged: "fp32" },
  });
}

function formatVttTimestamp(totalSeconds) {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function chunksToVtt(chunks) {
  const lines = ["WEBVTT", ""];
  for (const chunk of chunks) {
    const [start, endRaw] = chunk.timestamp;
    const end = endRaw == null ? start + 3 : endRaw;
    const text = chunk.text.trim();
    if (!text) continue;
    lines.push(`${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}`);
    lines.push(text);
    lines.push("");
  }
  return lines.join("\n");
}

// PCM cru (f32le, mono, 16kHz) — exatamente o formato que o Whisper espera,
// não precisa de parser de WAV nenhum, só ler os bytes direto pra
// Float32Array.
async function extractAudioPcm(sourcePath, pcmPath) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    sourcePath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(CAPTION_SAMPLE_RATE),
    "-f",
    "f32le",
    pcmPath,
  ]);
}

async function uploadCaptionsVtt(key, vttText) {
  const objectPath = `video-captions/${key}/legendas.vtt`;
  await withRetries(async () => {
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, Buffer.from(vttText, "utf8"), {
      contentType: "text/vtt",
      upsert: true,
    });
    if (error) throw error;
  }, 3, `upload Storage ${objectPath}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

// Faz a mesma cadência de 30s que o pipeline usava internamente
// (chunk_length_s: 30) no browser, só que à mão — cada volta do loop chama
// o transcriber com <=30s de áudio (dentro da janela nativa do Whisper),
// dá pra reportar progresso real (chunk a chunk) sem depender de nenhum
// callback interno da lib. Troca: perde-se o stride_length_s de 5s
// (overlap entre chunks que ajudava a não cortar palavras na fronteira) —
// aceitável pela granularidade de progresso ganha.
async function transcribeToVtt(key, sourcePath, workDir, onProgress) {
  const pcmPath = path.join(workDir, "audio.f32");
  await extractAudioPcm(sourcePath, pcmPath);
  const raw = await fs.readFile(pcmPath);
  await fs.rm(pcmPath, { force: true }).catch(() => {});

  // .slice() no ArrayBuffer copia pra um novo buffer com byteOffset 0 — o
  // Buffer devolvido por fs.readFile pode não estar alinhado a 4 bytes
  // (exigido pelo Float32Array), não dá pra ler o .buffer dele direto.
  const arrayBuffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length);
  const samples = new Float32Array(arrayBuffer);
  if (samples.length === 0) throw new Error("Áudio vazio (vídeo sem faixa de áudio?)");

  const chunkLenSamples = CAPTION_CHUNK_SECONDS * CAPTION_SAMPLE_RATE;
  const totalChunks = Math.max(1, Math.ceil(samples.length / chunkLenSamples));

  const transcriber = await getTranscriber();
  try {
    const allChunks = [];
    for (let i = 0; i < totalChunks; i++) {
      const slice = samples.subarray(i * chunkLenSamples, (i + 1) * chunkLenSamples);
      const output = await transcriber(slice, { language: "portuguese", task: "transcribe", return_timestamps: true });
      const result = Array.isArray(output) ? output[0] : output;
      const resultChunks = (result && result.chunks) || [];
      const offsetSeconds = i * CAPTION_CHUNK_SECONDS;
      for (const c of resultChunks) {
        const [start, endRaw] = c.timestamp;
        allChunks.push({ text: c.text, timestamp: [start + offsetSeconds, endRaw == null ? null : endRaw + offsetSeconds] });
      }
      onProgress(i + 1, totalChunks);
    }
    return await uploadCaptionsVtt(key, chunksToVtt(allChunks));
  } finally {
    // Liberta os ~300-400MB do modelo já — não fica à espera do GC
    // (onnxruntime-node é um addon nativo, memória fora do heap do V8 que
    // o GC do JS não sabe reclamar sozinho).
    if (typeof transcriber.dispose === "function") await transcriber.dispose().catch(() => {});
  }
}

// --- Caminho 1: upload direto (POST /upload) ---------------------------

// Token = "{assetId}.{expiresAt}.{assinatura}", assinado com o mesmo
// segredo partilhado que já protege /api/worker/jobs/* — a app gera-o em
// app/api/upload/authorize-direct, válido por pouco tempo, um assetId por
// upload (não está ligado a nenhuma aula ainda, isso só acontece quando a
// aula é gravada com este hlsMasterUrl).
function verifyUploadToken(token) {
  if (!token) {
    console.warn("[token] pedido sem Authorization: Bearer <token>");
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    console.warn(`[token] formato inesperado (${parts.length} partes, esperava 3)`);
    return null;
  }
  const [assetId, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!assetId || !/^[a-zA-Z0-9_-]+$/.test(assetId)) {
    console.warn(`[token] assetId inválido: "${assetId}"`);
    return null;
  }
  if (!Number.isFinite(expiresAt)) {
    console.warn(`[token] expiresAt inválido: "${expiresAtStr}"`);
    return null;
  }
  if (Date.now() > expiresAt) {
    console.warn(`[token] expirado — agora=${Date.now()}, expirava=${expiresAt}`);
    return null;
  }
  const expectedSig = crypto.createHmac("sha256", WORKER_API_SECRET).update(`${assetId}.${expiresAtStr}`).digest("hex");
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  if (sigBuf.length !== expectedBuf.length) {
    console.warn(`[token] assinatura com tamanho errado — recebida ${sigBuf.length} bytes, esperava ${expectedBuf.length}`);
    return null;
  }
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    console.warn("[token] assinatura não bate certo com WORKER_API_SECRET deste worker");
    return null;
  }
  return assetId;
}

// Path determinístico por assetId (não mkdtemp aleatório) — é o que
// permite a um retry encontrar e continuar o mesmo ficheiro parcial de uma
// tentativa anterior, em vez de começar sempre do zero.
function uploadWorkDir(assetId) {
  return path.join(os.tmpdir(), `direct-upload-${assetId}`);
}

async function getReceivedBytes(assetId) {
  try {
    const stat = await fs.stat(path.join(uploadWorkDir(assetId), "source"));
    return stat.size;
  } catch {
    return 0;
  }
}

// Checkpoint da COMPRESSÃO (não do upload — isso é o "source" + offset
// acima). Vídeos longos podem levar minutos a comprimir; se o pedido de
// /upload-finalize cair a meio (a app reporta isto como "erro de rede",
// mas é só o pedido HTTP em si a morrer, a compressão em curso no worker
// não sabe disso), sem isto um retry recomeçava a escada TODA — 480p e
// 720p já prontos incluídos — em vez de continuar só a partir do rung
// onde ficou. Grava-se depois de CADA rung concluído (ver transcodeToHls).
function transcodeProgressPath(workDir) {
  return path.join(workDir, "progress.json");
}

async function loadTranscodeProgress(workDir) {
  try {
    const raw = await fs.readFile(transcodeProgressPath(workDir), "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.renditions) && Array.isArray(data.variants)) return data;
  } catch {
    // sem checkpoint ainda (1ª tentativa) ou ficheiro corrompido — começa do zero
  }
  return { renditions: [], variants: [], masterPlaylistUrl: null };
}

async function saveTranscodeProgress(workDir, progress) {
  await fs.writeFile(transcodeProgressPath(workDir), JSON.stringify(progress)).catch(() => {});
}

// append=true (retoma): abre em modo "a", só acrescenta ao que já lá está.
// append=false (1ª tentativa): "w", começa do zero.
function pipeRequestToFile(req, destPath, append) {
  return new Promise((resolve, reject) => {
    const writeStream = fsSync.createWriteStream(destPath, { flags: append ? "a" : "w" });
    req.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);
    req.pipe(writeStream);
  });
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", APP_URL);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Upload-Offset, X-Total-Bytes");
}

function authenticateRequest(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return verifyUploadToken(token);
}

// GET /upload-status — o browser pergunta isto antes de cada retry, pra
// saber exatamente quantos bytes já chegaram e só reenviar o resto (ver
// FileUploadInput.tsx) em vez de reenviar o ficheiro todo outra vez.
async function handleUploadStatusRequest(req, res) {
  const assetId = authenticateRequest(req);
  if (!assetId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Token de upload inválido ou expirado" }));
    return;
  }
  const receivedBytes = await getReceivedBytes(assetId);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ receivedBytes }));
}

// POST /upload-chunk — recebe um bloco de tamanho fixo (ver CHUNK_BYTES no
// cliente) e só isso: acrescenta ao ficheiro fonte e responde já, sem
// comprimir nada. X-Upload-Offset é sempre obrigatório (mesmo no 1º bloco,
// com valor 0) — o cliente relê /upload-status antes de cada bloco, por
// isso este valor é sempre o que o worker já confirmou ter, nunca um
// contador só do lado do cliente; se não bater certo (corrida, worker
// reiniciou), 409 força o cliente a resincronizar antes de repetir.
async function handleUploadChunkRequest(req, res) {
  const assetId = authenticateRequest(req);
  if (!assetId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Token de upload inválido ou expirado" }));
    return;
  }

  const offsetHeader = req.headers["x-upload-offset"];
  const expectedOffset = Number(offsetHeader);
  if (typeof offsetHeader !== "string" || !Number.isFinite(expectedOffset) || expectedOffset < 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "X-Upload-Offset em falta ou inválido" }));
    return;
  }

  const workDir = uploadWorkDir(assetId);
  const sourcePath = path.join(workDir, "source");

  try {
    await fs.mkdir(workDir, { recursive: true });
    const actualBytes = await getReceivedBytes(assetId);
    if (expectedOffset !== actualBytes) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Offset desatualizado", receivedBytes: actualBytes }));
      return;
    }
    await pipeRequestToFile(req, sourcePath, expectedOffset > 0);
    const receivedBytes = await getReceivedBytes(assetId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ receivedBytes }));
  } catch (err) {
    console.error(`Bloco de upload ${assetId} falhou:`, err);
    if (!res.headersSent) {
      const receivedBytes = await getReceivedBytes(assetId).catch(() => 0);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err && err.message ? err.message : "Falha ao receber bloco", receivedBytes }));
    }
  }
}

// Estado das compressões em curso/concluídas, por assetId — em memória, não
// em disco: sobrevive a retries do MESMO processo, mas não a um restart do
// worker (nesse caso volta a "unknown", ver handleUploadFinalizeStatusRequest,
// e o cliente reabre a compressão do zero — que por sua vez retoma do
// checkpoint em disco, progress.json, a partir do rung onde ficou). Entradas
// concluídas ficam cacheadas indefinidamente (não só até o workDir ser
// limpo) pra um POST ou GET tardio (resposta anterior perdida em trânsito)
// continuar a encontrar o resultado em vez de um 404/400 que faria o
// cliente desistir por engano.
const finalizeJobs = new Map();

function startFinalizeJob(assetId, workDir, sourcePath) {
  finalizeJobs.set(assetId, { state: "processing", phase: "compressing", completed: 0, total: null });
  (async () => {
    try {
      const progress = await loadTranscodeProgress(workDir);
      const alreadyDone = progress.renditions.length;
      finalizeJobs.set(assetId, { state: "processing", phase: "compressing", completed: alreadyDone, total: null });
      if (alreadyDone > 0) {
        console.log(`  -> ${assetId} a retomar compressão (${alreadyDone} rendition(s) já prontas de uma tentativa anterior)`);
      } else {
        console.log(`  -> ${assetId} recebido por completo, a comprimir`);
      }
      const { renditions, masterPlaylistUrl } = await transcodeToHls(
        assetId,
        sourcePath,
        workDir,
        (rendition, masterPlaylistUrlSoFar, isLast, doneCount) => {
          // Um rung novo (não vindo do resume) acabou de ficar pronto —
          // completed passa a refletir a contagem exata (não soma +1 a
          // cima do que "onRungProgress" possa já ter deixado, que é
          // fracionário — ver abaixo).
          const job = finalizeJobs.get(assetId);
          if (job && job.state === "processing") finalizeJobs.set(assetId, { ...job, completed: doneCount });
        },
        {
          resume: progress,
          persistProgress: true,
          onPlan: (total) => {
            const job = finalizeJobs.get(assetId);
            if (job && job.state === "processing") finalizeJobs.set(assetId, { ...job, total });
          },
          // Progresso DENTRO do rung atual (ver runFfmpeg/-progress pipe:1)
          // — completed fica fracionário durante a codificação (ex.: 1.42 =
          // 1 rung pronto + 42% do 2º), dando granularidade de 1% ao
          // cliente sem mudar o formato da resposta (só um número).
          onRungProgress: (completed) => {
            const job = finalizeJobs.get(assetId);
            if (job && job.state === "processing") finalizeJobs.set(assetId, { ...job, completed });
          },
        }
      );
      if (renditions.length === 0 || !masterPlaylistUrl) throw new Error("Nenhuma rendition gerada");
      console.log(`Upload direto ${assetId}: vídeo comprimido (${renditions.length} rendition(s)), a gerar legendas`);

      // hlsMasterUrl/renditions já vão aqui (não só no "done" final) — o
      // vídeo já está pronto pra tocar, só faltam legendas, que podem
      // demorar bastante; o cliente usa isto pra trocar o preview pro
      // player custom (HLS) já nesta fase, sem esperar a transcrição.
      finalizeJobs.set(assetId, {
        state: "processing",
        phase: "transcribing",
        completed: 0,
        total: null,
        hlsMasterUrl: masterPlaylistUrl,
        renditions,
      });
      let captionsUrl = null;
      try {
        captionsUrl = await transcribeToVtt(assetId, sourcePath, workDir, (completed, total) => {
          const job = finalizeJobs.get(assetId);
          if (job && job.state === "processing") finalizeJobs.set(assetId, { ...job, completed, total });
        });
      } catch (err) {
        // Nunca derruba o upload por isto — vídeo já está comprimido e
        // pronto, a aula só fica sem legendas.
        console.error(`Legendas do upload ${assetId} falharam (aula fica sem legendas):`, err);
      }

      console.log(
        `Upload direto ${assetId} concluído (${renditions.length} rendition(s))${captionsUrl ? ", com legendas" : ", sem legendas"}.`
      );
      finalizeJobs.set(assetId, { state: "done", hlsMasterUrl: masterPlaylistUrl, renditions, captionsUrl });
      // só limpa o work dir em caso de sucesso — numa falha o ficheiro fonte
      // fica pra um retry poder recomeçar a comprimir sem reenviar nada.
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    } catch (err) {
      console.error(`Finalização do upload ${assetId} falhou:`, err);
      finalizeJobs.set(assetId, { state: "error", error: err && err.message ? err.message : "Falha ao comprimir vídeo" });
    }
  })();
}

// POST /upload-finalize — chamado depois de todos os blocos enviados, sem
// corpo. Só DISPARA a compressão em fundo e responde já (202) — não fica à
// espera dela acabar. Um vídeo de ~1h pode levar bem mais que o teto de
// pedido HTTP da própria Railway (15min, ver server.requestTimeout mais
// abaixo) só num rung; manter o pedido aberto até ao fim batia nesse teto
// sempre no mesmo ponto, nunca chegando a terminar por mais retries que
// desse. O cliente acompanha o progresso via GET /upload-finalize-status.
async function handleUploadFinalizeRequest(req, res) {
  const assetId = authenticateRequest(req);
  if (!assetId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Token de upload inválido ou expirado" }));
    return;
  }

  const existing = finalizeJobs.get(assetId);
  if (existing && existing.state === "processing") {
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ state: "processing" }));
    return;
  }
  if (existing && existing.state === "done") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ state: "done", hlsMasterUrl: existing.hlsMasterUrl, renditions: existing.renditions }));
    return;
  }

  // Sem job em curso (1ª chamada, ou uma tentativa anterior falhou/o
  // processo reiniciou) — valida os bytes recebidos e arranca uma nova.
  const workDir = uploadWorkDir(assetId);
  const sourcePath = path.join(workDir, "source");
  const totalHeader = req.headers["x-total-bytes"];
  const expectedTotal = Number(totalHeader);

  const actualBytes = await getReceivedBytes(assetId);
  if (actualBytes === 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Nenhum byte recebido para este upload" }));
    return;
  }
  if (typeof totalHeader === "string" && Number.isFinite(expectedTotal) && expectedTotal !== actualBytes) {
    res.writeHead(409, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Upload incompleto", receivedBytes: actualBytes }));
    return;
  }

  startFinalizeJob(assetId, workDir, sourcePath);
  res.writeHead(202, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ state: "processing" }));
}

// GET /upload-finalize-status — o cliente faz poll nisto depois de disparar
// a finalização, em vez de segurar um único pedido HTTP durante a
// compressão toda. "unknown" (404) cobre tanto "nunca chamou finalize" como
// "o worker reiniciou a meio" — a resposta é a mesma nos dois casos, e cabe
// ao cliente decidir repetir o POST de finalize para (re)arrancar.
async function handleUploadFinalizeStatusRequest(req, res) {
  const assetId = authenticateRequest(req);
  if (!assetId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Token de upload inválido ou expirado" }));
    return;
  }

  const job = finalizeJobs.get(assetId);
  if (!job) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ state: "unknown" }));
    return;
  }
  if (job.state === "done") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        state: "done",
        hlsMasterUrl: job.hlsMasterUrl,
        renditions: job.renditions,
        captionsUrl: job.captionsUrl ?? null,
      })
    );
    return;
  }
  if (job.state === "error") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ state: "error", error: job.error }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      state: "processing",
      phase: job.phase,
      completed: job.completed,
      total: job.total,
      // Só vem preenchido a partir da fase "transcribing" (ver
      // startFinalizeJob) — vídeo já comprimido e pronto, mesmo com
      // legendas ainda a caminho.
      hlsMasterUrl: job.hlsMasterUrl ?? undefined,
    })
  );
}

const server = http.createServer((req, res) => {
  console.log(`[http] ${req.method} ${req.url} — origin=${req.headers["origin"] || "?"}`);
  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "POST" && req.url === "/upload-chunk") {
    setCorsHeaders(res);
    handleUploadChunkRequest(req, res).catch((err) => {
      console.error("Erro não tratado no /upload-chunk:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Erro interno" }));
      }
    });
    return;
  }
  if (req.method === "POST" && req.url === "/upload-finalize") {
    setCorsHeaders(res);
    handleUploadFinalizeRequest(req, res).catch((err) => {
      console.error("Erro não tratado no /upload-finalize:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Erro interno" }));
      }
    });
    return;
  }
  if (req.method === "GET" && req.url === "/upload-status") {
    setCorsHeaders(res);
    handleUploadStatusRequest(req, res).catch((err) => {
      console.error("Erro não tratado no /upload-status:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Erro interno" }));
      }
    });
    return;
  }
  if (req.method === "GET" && req.url === "/upload-finalize-status") {
    setCorsHeaders(res);
    handleUploadFinalizeStatusRequest(req, res).catch((err) => {
      console.error("Erro não tratado no /upload-finalize-status:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Erro interno" }));
      }
    });
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

// --- Caminho 2: fila assíncrona (poll a /api/worker/jobs/next) ---------

async function processJob(job) {
  console.log(`A processar job ${job.id} (aula ${job.lessonId})`);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "transcode-"));
  const sourcePath = path.join(workDir, "source");

  try {
    await downloadSource(job.sourceUrl, sourcePath);
    const { renditions } = await transcodeToHls(job.lessonId, sourcePath, workDir, (rendition, masterPlaylistUrl, isLast) =>
      reportRendition(job.id, rendition, masterPlaylistUrl, isLast)
    );
    console.log(`Job ${job.id} concluído (${renditions.length} rendition(s)).`);
  } catch (err) {
    console.error(`Job ${job.id} falhou:`, err);
    await failJob(job.id, err && err.message ? err.message : err);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function loop() {
  console.log(`Worker de transcoding a arrancar — a fazer poll a ${APP_URL} a cada ${POLL_INTERVAL_MS}ms`);
  for (;;) {
    try {
      const job = await claimNextJob();
      if (job) {
        await processJob(job);
        continue; // logo a seguir tenta o próximo, sem esperar o intervalo
      }
    } catch (err) {
      console.error("Erro no ciclo do worker:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Node's http.Server tem um requestTimeout DEFAULT de 5 minutos (desde o
// Node 18) — mata sozinho qualquer pedido que ainda esteja aberto passado
// esse tempo, nada a ver com o limite da própria Railway (15min de teto na
// plataforma). Nenhum pedido devia mesmo chegar perto disso agora que
// /upload-chunk é sempre curto (bloco de tamanho fixo) e /upload-finalize só
// dispara a compressão em fundo e responde já (ver startFinalizeJob — antes
// ficava aberto durante a compressão toda, que em vídeos grandes passava
// facilmente do teto da própria Railway e nunca chegava a terminar). Sobe-se
// mesmo assim pro teto da Railway, de segurança.
server.requestTimeout = 15 * 60 * 1000;
server.headersTimeout = 60 * 1000;
// server.timeout (mecanismo mais antigo, timeout de inatividade do socket)
// — 0 desativa, deixa só o requestTimeout de cima e o teto da própria
// Railway a decidir.
server.timeout = 0;

server.listen(UPLOAD_PORT, () => {
  console.log(`Servidor de upload direto a ouvir na porta ${UPLOAD_PORT}`);
});

// Sem isto, uma exceção não apanhada em qualquer lado (incluindo no loop()
// de fundo, nada a ver com uploads) derruba o processo INTEIRO sem deixar
// rasto — Railway reinicia o container sozinho, mas o pedido de upload em
// curso morre a meio sem explicação nenhuma (só um 502 do lado do
// cliente). Loga o motivo real antes de sair, pra a próxima vez que isto
// acontecer dar pra ver porquê nos logs em vez de adivinhar.
process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException — processo vai reiniciar:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection — processo vai reiniciar:", reason);
  process.exit(1);
});

loop();
