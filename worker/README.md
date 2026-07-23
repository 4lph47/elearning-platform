# Worker de transcoding de vídeo

Serviço separado, sempre ligado, que faz o trabalho que o Vercel não
consegue fazer: correr `ffmpeg` para gerar HLS (segmentado, várias
qualidades, 480p a 2160p) de cada vídeo de aula enviado.

## Como funciona

1. A app Next.js grava um `VideoTranscodeJob` (status `PENDING`) sempre que
   uma aula fica com um vídeo novo (`lib/videoTranscode.ts`). O `sourceUrl`
   do job tanto pode ser um vídeo direto como um `manifest.json` (vídeos
   grandes sobem em partes por causa do teto de 50MB por objeto do Supabase
   Free — ver `components/instructor/FileUploadInput.tsx`).
2. Este worker faz poll a `GET /api/worker/jobs/next` a cada poucos
   segundos, reclama o job mais antigo pendente.
3. Descarrega o vídeo original (ou reconstitui-o a partir das partes do
   manifesto), corre `ffprobe` para saber a resolução, e para cada qualidade
   — do MENOR pro MAIOR, pra ficar reproduzível o mais cedo possível — gera
   uma variante HLS (segmentos `.ts` + `index.m3u8`, nunca faz upscale) e
   sobe pra Supabase Storage.
4. Depois de CADA variante (não só no fim), chama
   `POST /api/worker/jobs/:id/complete` com essa rendition e o master
   playlist atualizado — a aula fica reproduzível assim que a 1ª existe, o
   resto da escada vai enchendo em fundo. `/fail` se algo correr mal.

O player (`components/player/LessonPlayer.tsx`) usa hls.js (ou HLS nativo no
Safari) para ler o master playlist da aula e troca de qualidade sozinho
consoante a largura de banda — o menu de qualidade só lista manualmente as
aulas antigas que ainda não passaram por este pipeline.

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

## Deploy no Render

Por defeito o Render tenta correr como app Node normal (`npm run build` +
`npm start`) — este worker não tem `build`, por isso falha com
`Missing script: "build"` a não ser que se force o runtime Docker.

1. **New → Background Worker** (não "Web Service" — isto não expõe porta
   nenhuma) → liga ao repositório.
2. **Root Directory**: `worker`
3. **Runtime**: muda de "Node" para **Docker** — só assim usa o
   `worker/Dockerfile` em vez do buildpack automático.
4. **Environment** → adiciona as mesmas variáveis da secção do Railway
   acima (`APP_URL`, `WORKER_API_SECRET`, `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`).
5. Deploy. Nos **Logs** deve aparecer `Worker de transcoding a arrancar`.

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
