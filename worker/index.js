// Worker de transcoding de vídeo — corre fora do Vercel (sem ffmpeg nem
// tempo de execução para isto nas functions serverless). Faz poll a
// /api/worker/jobs/next, transcodifica com ffmpeg pra HLS (segmentado, várias
// qualidades) e sobe cada variante para o Supabase Storage à medida que fica
// pronta — reporta-se logo (ver /complete), sem esperar a escada toda, para
// a aula ficar reproduzível o mais cedo possível. Ver README.md deste
// diretório para deploy.

const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
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

// Do menor pro maior — processado por essa ordem (ver processJob) para a
// aula ficar reproduzível o mais cedo possível (rung pequeno = rápido de
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

async function fetchToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download falhou (${url}): HTTP ${res.status}`);
  await fs.writeFile(destPath, Buffer.from(await res.arrayBuffer()));
}

// O bucket Supabase trava em 50MB por objeto (plano Free) — vídeos grandes
// sobem em partes bem abaixo disso (ver FileUploadInput.tsx), e o "sourceUrl"
// do job aponta pra um manifest.json com a lista ordenada dessas partes, em
// vez de um vídeo direto. Aqui descarrega-se cada parte pela ordem e
// concatena-se num único ficheiro local — como o corte foi só por bytes (não
// por conteúdo), o resultado é byte-a-byte idêntico ao ficheiro original.
async function downloadSource(sourceUrl, destPath, workDir) {
  if (!sourceUrl.endsWith("/manifest.json")) {
    await fetchToFile(sourceUrl, destPath);
    return;
  }

  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Download do manifesto falhou: HTTP ${res.status}`);
  const manifest = await res.json();
  if (!Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new Error("Manifesto de vídeo sem partes");
  }

  const fh = await fs.open(destPath, "w");
  try {
    for (let i = 0; i < manifest.parts.length; i++) {
      const partPath = path.join(workDir, `part-${i}`);
      await fetchToFile(manifest.parts[i], partPath);
      const buffer = await fs.readFile(partPath);
      await fh.write(buffer);
      await fs.unlink(partPath).catch(() => {});
    }
  } finally {
    await fh.close();
  }
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
// video-renditions/{lessonId}/{label}/ — devolve o URL público do índice e o
// total de bytes (soma de todos os ficheiros, usado só como métrica).
async function uploadRenditionDir(lessonId, label, dirPath) {
  const files = await fs.readdir(dirPath);
  let totalBytes = 0;
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const buffer = await fs.readFile(filePath);
    totalBytes += buffer.byteLength;
    const objectPath = `video-renditions/${lessonId}/${label}/${file}`;
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
      contentType: contentTypeFor(file),
      upsert: true,
    });
    if (error) throw error;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`video-renditions/${lessonId}/${label}/index.m3u8`);
  return { indexUrl: data.publicUrl, totalBytes };
}

async function uploadMasterPlaylist(lessonId, variants) {
  // Ordenado por bandwidth ascendente — convenção HLS, ajuda o player a
  // escolher a variante inicial mais baixa em ligações lentas.
  const sorted = [...variants].sort((a, b) => a.bandwidth - b.bandwidth);
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const v of sorted) {
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidth},RESOLUTION=${v.width}x${v.height}`);
    lines.push(`${v.label}/index.m3u8`);
  }
  const content = lines.join("\n") + "\n";
  const objectPath = `video-renditions/${lessonId}/master.m3u8`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, Buffer.from(content), {
    contentType: "application/vnd.apple.mpegurl",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function processJob(job) {
  console.log(`A processar job ${job.id} (aula ${job.lessonId})`);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "transcode-"));
  const sourcePath = path.join(workDir, "source");

  try {
    await downloadSource(job.sourceUrl, sourcePath, workDir);
    const { height: sourceHeight } = await probeDimensions(sourcePath);
    const durationSeconds = await probeDuration(sourcePath);

    let rungs = QUALITY_LADDER.filter((r) => sourceHeight >= r.height * 0.9);
    if (rungs.length === 0) {
      // Fonte mais pequena que o degrau mínimo (480p) — só gera nessa mesma altura.
      rungs = [{ label: `${sourceHeight}p`, height: sourceHeight }];
    }

    const variantsSoFar = [];
    for (let i = 0; i < rungs.length; i++) {
      const rung = rungs[i];
      const outDir = path.join(workDir, rung.label);
      const isNearSource = Math.abs(sourceHeight - rung.height) <= sourceHeight * 0.1;

      await transcodeRenditionHls(sourcePath, outDir, rung.height, isNearSource);

      const segFiles = (await fs.readdir(outDir)).filter((f) => f.endsWith(".ts"));
      const { width, height } = await probeDimensions(path.join(outDir, segFiles[0]));
      const { indexUrl, totalBytes } = await uploadRenditionDir(job.lessonId, rung.label, outDir);
      const bandwidth = durationSeconds > 0 ? Math.round((totalBytes * 8) / durationSeconds) : 1_000_000;

      variantsSoFar.push({ label: rung.label, width, height, bandwidth });
      const masterPlaylistUrl = await uploadMasterPlaylist(job.lessonId, variantsSoFar);

      const isLast = i === rungs.length - 1;
      await reportRendition(
        job.id,
        { quality: rung.label, url: indexUrl, width, height, sizeBytes: totalBytes },
        masterPlaylistUrl,
        isLast
      );

      await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
      console.log(`  -> ${rung.label} pronto (${(totalBytes / 1024 / 1024).toFixed(1)}MB)`);
    }

    console.log(`Job ${job.id} concluído (${variantsSoFar.length} rendition(s)).`);
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

loop();
