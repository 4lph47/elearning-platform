// Worker de transcoding de vídeo — corre fora do Vercel (sem ffmpeg nem
// tempo de execução para isto nas functions serverless), com ffmpeg pra
// gerar HLS (segmentado, várias qualidades) de cada vídeo de aula.
//
// Dois jeitos de chegar aqui:
// 1. Upload direto (normal): o browser envia o vídeo bruto diretamente pra
//    cá via POST /upload (autenticado por um token HMAC de curta duração
//    que a app gera — ver app/api/upload/authorize-direct). Comprime-se
//    ANTES de qualquer coisa tocar o Supabase Storage — só as renditions
//    finais (pequenas) lá chegam, nunca o ficheiro bruto. Resposta só volta
//    quando a escada toda estiver pronta.
// 2. Fila assíncrona (fallback): se alguém colar um URL de vídeo já
//    existente em vez de fazer upload (ver contentUrl em LessonEditScreen),
//    a app cria um VideoTranscodeJob e este worker apanha-o via poll a
//    /api/worker/jobs/next — mesmo pipeline de transcode, só muda de onde
//    vem o ficheiro fonte.
//
// Ver README.md deste diretório para deploy (agora precisa de expor porta —
// deixou de ser só um poller em fundo).

const { execFile } = require("node:child_process");
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

// Do menor pro maior — processado por essa ordem (ver transcodeToHls) para
// ficar reproduzível o mais cedo possível (rung pequeno = rápido de
// codificar). Só se gera uma rendition se o vídeo de origem for pelo menos
// dessa altura (nunca faz upscale).
const QUALITY_LADDER = [
  { label: "480p", height: 480 },
  { label: "720p", height: 720 },
  { label: "1080p", height: 1080 },
  { label: "1440p", height: 1440 },
  { label: "2160p", height: 2160 },
];

async function apiFetch(pathname, init) {
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
  const res = await fetch(sourceUrl);
  if (!res.ok || !res.body) throw new Error(`Download da fonte falhou: HTTP ${res.status}`);
  await fs.writeFile(destPath, Buffer.from(await res.arrayBuffer()));
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

// HLS segmentado — para o rung mais próximo da fonte, "-c copy" só remuxa
// (sem recodificar, muito mais rápido, sem perda); os restantes recodificam
// no tamanho alvo.
async function transcodeRenditionHls(sourcePath, outDir, targetHeight, copyOnly) {
  await fs.mkdir(outDir, { recursive: true });
  const playlistPath = path.join(outDir, "index.m3u8");
  const segmentPattern = path.join(outDir, "seg%03d.ts");

  // H.264 continua a ser o único codec com suporte universal (Chrome/Firefox
  // não decodificam HEVC de forma fiável, Safari só suporta AV1 parcialmente
  // — testado antes de decidir, não é suposição). Preset "slow" em vez de
  // "veryfast": mesmo CRF, ~10-15% menos bytes pela mesma qualidade visual —
  // custa mais tempo de CPU, mas isto corre em fundo, sem ninguém à espera.
  const codecArgs = copyOnly
    ? ["-c", "copy"]
    : [
        "-vf",
        `scale=-2:${targetHeight}`,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-profile:v",
        "high",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
      ];

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    ...codecArgs,
    "-hls_time",
    String(HLS_SEGMENT_SECONDS),
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    segmentPattern,
    playlistPath,
  ]);
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
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: contentTypeFor(file),
      upsert: true,
    });
    if (error) throw error;
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
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, Buffer.from(content), {
    contentType: "application/vnd.apple.mpegurl",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

// Núcleo partilhado pelos dois caminhos (upload direto e fila assíncrona):
// dado um ficheiro já em disco local, gera a escada HLS completa, subindo
// (e reportando, via onRendition) cada rung assim que fica pronto — não só
// no fim. onRendition pode ser null (upload direto não precisa de reportar
// rung a rung, só devolve tudo no fim da resposta HTTP).
async function transcodeToHls(key, sourcePath, workDir, onRendition) {
  const { height: sourceHeight } = await probeDimensions(sourcePath);
  const durationSeconds = await probeDuration(sourcePath);

  let rungs = QUALITY_LADDER.filter((r) => sourceHeight >= r.height * 0.9);
  if (rungs.length === 0) {
    // Fonte mais pequena que o degrau mínimo (480p) — só gera nessa mesma altura.
    rungs = [{ label: `${sourceHeight}p`, height: sourceHeight }];
  }

  const variantsSoFar = [];
  const renditions = [];
  let masterPlaylistUrl = null;

  for (let i = 0; i < rungs.length; i++) {
    const rung = rungs[i];
    const outDir = path.join(workDir, rung.label);
    const isNearSource = Math.abs(sourceHeight - rung.height) <= sourceHeight * 0.1;

    await transcodeRenditionHls(sourcePath, outDir, rung.height, isNearSource);

    const segFiles = (await fs.readdir(outDir)).filter((f) => f.endsWith(".ts"));
    const { width, height } = await probeDimensions(path.join(outDir, segFiles[0]));
    const { indexUrl, totalBytes } = await uploadRenditionDir(key, rung.label, outDir);
    const bandwidth = durationSeconds > 0 ? Math.round((totalBytes * 8) / durationSeconds) : 1_000_000;

    variantsSoFar.push({ label: rung.label, width, height, bandwidth });
    masterPlaylistUrl = await uploadMasterPlaylist(key, variantsSoFar);

    const rendition = { quality: rung.label, url: indexUrl, width, height, sizeBytes: totalBytes };
    renditions.push(rendition);
    const isLast = i === rungs.length - 1;
    if (onRendition) await onRendition(rendition, masterPlaylistUrl, isLast);

    await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
    console.log(`  -> ${rung.label} pronto (${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
  }

  return { renditions, masterPlaylistUrl };
}

// --- Caminho 1: upload direto (POST /upload) ---------------------------

// Token = "{assetId}.{expiresAt}.{assinatura}", assinado com o mesmo
// segredo partilhado que já protege /api/worker/jobs/* — a app gera-o em
// app/api/upload/authorize-direct, válido por pouco tempo, um assetId por
// upload (não está ligado a nenhuma aula ainda, isso só acontece quando a
// aula é gravada com este hlsMasterUrl).
function verifyUploadToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [assetId, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!assetId || !/^[a-zA-Z0-9_-]+$/.test(assetId) || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null;
  }
  const expectedSig = crypto.createHmac("sha256", WORKER_API_SECRET).update(`${assetId}.${expiresAtStr}`).digest("hex");
  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  return assetId;
}

function pipeRequestToFile(req, destPath) {
  return new Promise((resolve, reject) => {
    const writeStream = fsSync.createWriteStream(destPath);
    req.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);
    req.pipe(writeStream);
  });
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", APP_URL);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

async function handleUploadRequest(req, res) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const assetId = verifyUploadToken(token);
  if (!assetId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Token de upload inválido ou expirado" }));
    return;
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "direct-upload-"));
  const sourcePath = path.join(workDir, "source");

  try {
    console.log(`A receber upload direto ${assetId}`);
    await pipeRequestToFile(req, sourcePath);
    console.log(`  -> recebido, a comprimir ${assetId}`);
    const { renditions, masterPlaylistUrl } = await transcodeToHls(assetId, sourcePath, workDir, null);
    if (renditions.length === 0 || !masterPlaylistUrl) throw new Error("Nenhuma rendition gerada");
    console.log(`Upload direto ${assetId} concluído (${renditions.length} rendition(s)).`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ hlsMasterUrl: masterPlaylistUrl, renditions }));
  } catch (err) {
    console.error(`Upload direto ${assetId} falhou:`, err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err && err.message ? err.message : "Falha ao comprimir vídeo" }));
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "POST" && req.url === "/upload") {
    setCorsHeaders(res);
    handleUploadRequest(req, res).catch((err) => {
      console.error("Erro não tratado no upload:", err);
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

server.listen(UPLOAD_PORT, () => {
  console.log(`Servidor de upload direto a ouvir na porta ${UPLOAD_PORT}`);
});

loop();
