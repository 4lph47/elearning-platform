# Worker de transcoding de vídeo

Serviço separado, sempre ligado, que faz o trabalho que o Vercel não
consegue fazer: correr `ffmpeg` para gerar várias qualidades (480p a 2160p)
de cada vídeo de aula enviado.

## Como funciona

1. A app Next.js grava um `VideoTranscodeJob` (status `PENDING`) sempre que
   uma aula fica com um vídeo novo (`lib/videoTranscode.ts`).
2. Este worker faz poll a `GET /api/worker/jobs/next` a cada poucos
   segundos, reclama o job mais antigo pendente.
3. Descarrega o vídeo original, corre `ffprobe` para saber a resolução,
   gera uma rendition por qualidade (nunca upscale — só gera até à
   resolução da fonte), sobe cada uma para o Supabase Storage.
4. Chama `POST /api/worker/jobs/:id/complete` com os URLs resultantes (ou
   `/fail` se algo correr mal).

O player (`components/player/LessonPlayer.tsx`) lê as renditions da aula e
mostra o seletor de qualidade quando há mais que uma.

## Deploy no Railway

1. No Railway: **New Project → Deploy from GitHub repo**, aponta para este
   repositório.
2. Nas definições do serviço, define o **root directory** como `worker/`
   (Railway deteta o `Dockerfile` automaticamente).
3. Variáveis de ambiente do serviço (Settings → Variables):
   - `APP_URL` — URL pública da app Next.js (ex.: `https://o-teu-site.vercel.app`, sem barra final)
   - `WORKER_API_SECRET` — o mesmo valor que puseres em `WORKER_API_SECRET` nas env vars do Vercel
   - `SUPABASE_URL` — igual ao da app
   - `SUPABASE_SECRET_KEY` — igual ao da app
   - `SUPABASE_STORAGE_BUCKET` — igual ao da app (default `course-media`)
   - `POLL_INTERVAL_MS` — opcional, default `8000`
4. Deploy. Não expõe porta nenhuma (não é um servidor HTTP) — no Railway,
   marca o serviço como **worker/background**, não "web", para não tentar
   fazer healthcheck a uma porta.
5. Gerar o `WORKER_API_SECRET` uma vez: `openssl rand -hex 32` (ou
   qualquer string aleatória longa) — mete o mesmo valor no Vercel
   (`WORKER_API_SECRET`) e no Railway.

## Testar localmente

```bash
cd worker
npm install
# precisa de ffmpeg/ffprobe instalados na máquina (brew install ffmpeg / apt install ffmpeg)
APP_URL=http://localhost:3000 \
WORKER_API_SECRET=dev-secret \
SUPABASE_URL=... \
SUPABASE_SECRET_KEY=... \
node index.js
```
