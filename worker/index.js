// Worker de transcoding de vídeo — corre fora do Vercel (sem ffmpeg nem
// tempo de execução para isto nas functions serverless). Faz poll a
// /api/worker/jobs/next, transcodifica com ffmpeg em vários tamanhos, sobe
// cada rendition para o Supabase Storage e fecha o job via /complete (ou
// /fail se algo correr mal). Ver README.md deste diretório para deploy.

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

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Falta a variável de ambiente ${name}`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Do maior pro menor — só se gera uma rendition se o vídeo de origem for
// pelo menos dessa altura (nunca faz upscale).
const QUALITY_LADDER = [
  { label: "2160p", height: 2160 },
  { label: "1440p", height: 1440 },
  { label: "1080p", height: 1080 },
  { label: "720p", height: 720 },
  { label: "480p", height: 480 },
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

async function completeJob(jobId, renditions) {
  await apiFetch(`/api/worker/jobs/${jobId}/complete`, {
    method: "POST",
    body: JSON.stringify({ renditions }),
  });
}

async function failJob(jobId, error) {
  await apiFetch(`/api/worker/jobs/${jobId}/fail`, {
    method: "POST",
    body: JSON.stringify({ error: String(error).slice(0, 2000) }),
  }).catch((e) => console.error(`Falhou a marcar job ${jobId} como FAILED também:`, e));
}

async function downloadToTmp(url, destPath) {
  const res = await fetch(url);
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

async function transcodeRendition(sourcePath, destPath, targetHeight) {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-vf",
    `scale=-2:${targetHeight}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    destPath,
  ]);
}

// Rung do topo (igual ou quase igual à fonte): remux sem recodificar —
// muito mais rápido, e não há perda de qualidade nenhuma a "melhorar".
async function remux(sourcePath, destPath) {
  await execFileAsync("ffmpeg", ["-y", "-i", sourcePath, "-c", "copy", "-movflags", "+faststart", destPath]);
}

async function uploadRendition(lessonId, label, filePath) {
  const buffer = await fs.readFile(filePath);
  const objectPath = `video-renditions/${lessonId}/${label}-${Date.now()}.mp4`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return { url: data.publicUrl, sizeBytes: buffer.byteLength };
}

async function processJob(job) {
  console.log(`A processar job ${job.id} (aula ${job.lessonId})`);
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "transcode-"));
  const sourcePath = path.join(workDir, "source");

  try {
    await downloadToTmp(job.sourceUrl, sourcePath);
    const { height: sourceHeight } = await probeDimensions(sourcePath);

    const rungs = QUALITY_LADDER.filter((r) => sourceHeight >= r.height * 0.9);
    if (rungs.length === 0) {
      // Fonte mais pequena que o degrau mínimo (480p) — só gera nessa mesma altura.
      rungs.push({ label: `${sourceHeight}p`, height: sourceHeight });
    }

    const renditions = [];
    for (let i = 0; i < rungs.length; i++) {
      const rung = rungs[i];
      const outPath = path.join(workDir, `${rung.label}.mp4`);
      const isTopRung = i === 0;

      if (isTopRung && Math.abs(sourceHeight - rung.height) <= sourceHeight * 0.1) {
        await remux(sourcePath, outPath);
      } else {
        await transcodeRendition(sourcePath, outPath, rung.height);
      }

      const dims = await probeDimensions(outPath);
      const { url, sizeBytes } = await uploadRendition(job.lessonId, rung.label, outPath);
      renditions.push({ quality: rung.label, url, width: dims.width, height: dims.height, sizeBytes });
      await fs.unlink(outPath).catch(() => {});
      console.log(`  -> ${rung.label} pronto (${(sizeBytes / 1024 / 1024).toFixed(1)}MB)`);
    }

    await completeJob(job.id, renditions);
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

loop();
