# Worker de transcoding de vídeo

Serviço separado, sempre ligado, que faz o trabalho que o Vercel não
consegue fazer: correr `ffmpeg` para gerar HLS (segmentado, várias
qualidades) de cada vídeo de aula enviado. Expõe um endpoint
HTTP de upload direto — passou a precisar de porta exposta, deixou de ser só
um poller em fundo.

> **Teto temporário: 1080p.** A escada (`QUALITY_LADDER` em `index.js`) só
> vai até 1080p — 1440p/2160p ficavam mortos por SIGKILL (falta de memória
> no container), mesmo já com o encoder ajustado ao mínimo razoável
> (preset `fast`, `rc-lookahead=20`, `ref=2`, `-threads 2`). Pra voltar a
> 4K de verdade: aumenta a RAM alocada ao serviço do worker no Railway
> (Settings do serviço, ou plano da conta se for isso que limita), depois
> acrescenta `1440p`/`2160p` de volta ao array.

## Como funciona

**Caminho normal — upload direto:**

1. O browser pede um token de upload a `POST /api/upload/authorize-direct`
   (app Next.js, autenticado por sessão de instrutor) — token de curta
   duração (30min), assinado com `WORKER_API_SECRET`, ligado a um `assetId`
   novo (a aula ainda nem existe na BD nesta altura).
2. O browser envia o vídeo bruto diretamente para este worker, em blocos de
   50MB via `POST /upload-chunk` (sem passar pelo Vercel nem pelo Supabase
   Storage). Cada bloco é um pedido HTTP curto — evita um único pedido a
   durar o upload inteiro (minutos, em vídeos grandes), que se mostrou
   vulnerável a resets de ligação a meio (proxy/rede, fora do nosso
   controlo); um reset só perde o bloco em curso, não o envio todo. O
   cliente confirma quantos bytes o worker já tem via `GET /upload-status`
   antes de cada bloco, nunca confia só na sua própria contagem. Sem o teto
   de 50MB por OBJETO do Supabase Free, porque o Storage nem entra em jogo
   nesta parte (o teto é por objeto final, não pelo tamanho dos blocos).
3. Depois do último bloco, o browser chama `POST /upload-finalize` (sem
   corpo). O worker corre `ffprobe`, e para cada qualidade — do MENOR pro
   MAIOR — gera uma variante HLS (segmentos `.ts` + `index.m3u8`, nunca faz
   upscale) e SÓ ENTÃO sobe pro Supabase Storage (já comprimido). Cada rung
   concluído fica gravado num checkpoint (`progress.json` no work dir) —
   um vídeo longo pode levar minutos a comprimir, e se o pedido de
   `/upload-finalize` cair a meio (aparece como "erro de rede" do lado do
   browser, mesmo sem nada de errado na compressão em si), o cliente repete
   a chamada (retry infinito, ver `FileUploadInput.tsx`) e o worker retoma a
   partir do rung onde ficou, sem recomeçar a escada toda.
4. Quando a escada toda estiver pronta, responde ao pedido de finalização
   com o URL do master playlist. O browser guarda-o como `contentUrl` da
   aula — ao gravar a aula, a app já regista isto como `hlsMasterUrl`
   diretamente (ver `lib/videoTranscode.ts:isProcessedHlsUrl`), sem fila
   nenhuma.

**Caminho de recurso — fila assíncrona** (só entra em jogo se alguém colar
um URL de vídeo à mão em vez de fazer upload):

1. A app grava um `VideoTranscodeJob` (`lib/videoTranscode.ts`).
2. Este worker faz poll a `GET /api/worker/jobs/next`, reclama o job mais
   antigo pendente, descarrega o vídeo desse URL.
3. Mesmo pipeline de transcode (núcleo partilhado, `transcodeToHls` em
   `index.js`) — mas reporta cada rendition via
   `POST /api/worker/jobs/:id/complete` à medida que fica pronta, em vez de
   devolver tudo numa resposta HTTP síncrona.

O player (`components/player/LessonPlayer.tsx`, e a pré-visualização do
editor em `components/player/HlsVideo.tsx`) usa hls.js (ou HLS nativo no
Safari) para ler o master playlist e trocar de qualidade sozinho consoante a
largura de banda — o menu de qualidade manual só serve pra aulas antigas de
antes deste pipeline.

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
   - `PORT` — o Railway injeta isto automaticamente, não precisas de definir
4. Deploy. **Agora expõe porta** (endpoint de upload direto) — marca o
   serviço como **web** (não "worker/background" como antes), Railway faz
   healthcheck a `GET /health`.
5. Copia o domínio público que o Railway atribuiu ao serviço (Settings →
   Networking → Public Networking → Generate Domain, se ainda não tiver
   um) e mete-o no Vercel como `WORKER_PUBLIC_URL` (sem barra final).
6. Gerar o `WORKER_API_SECRET` uma vez: `openssl rand -hex 32` (ou
   qualquer string aleatória longa) — mete o mesmo valor no Vercel
   (`WORKER_API_SECRET`) e no Railway.

## Deploy no Render

Por defeito o Render tenta correr como app Node normal (`npm run build` +
`npm start`) — este worker não tem `build`, por isso falha com
`Missing script: "build"` a não ser que se force o runtime Docker.

1. **New → Web Service** (não "Background Worker" — agora expõe porta) →
   liga ao repositório.
2. **Root Directory**: `worker`
3. **Runtime**: muda de "Node" para **Docker** — só assim usa o
   `worker/Dockerfile` em vez do buildpack automático.
4. **Health Check Path**: `/health`
5. **Environment** → adiciona as mesmas variáveis da secção do Railway
   acima (`APP_URL`, `WORKER_API_SECRET`, `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`).
6. Deploy. Copia o domínio público do serviço, mete-o no Vercel como
   `WORKER_PUBLIC_URL`.
7. Nos **Logs** deve aparecer `Servidor de upload direto a ouvir na porta`
   e `Worker de transcoding a arrancar`.

## Variáveis do lado da app (Vercel)

Além do `WORKER_API_SECRET` (mesmo valor dos dois lados), a app agora
também precisa de:
- `WORKER_PUBLIC_URL` — URL pública do worker (Railway/Render), sem barra
  final. Usado só server-side (`app/api/upload/authorize-direct`) para
  dizer ao browser para onde enviar o vídeo.

## Testar localmente

```bash
cd worker
npm install
# precisa de ffmpeg/ffprobe instalados na máquina (brew install ffmpeg / apt install ffmpeg)
APP_URL=http://localhost:3000 \
WORKER_API_SECRET=dev-secret \
SUPABASE_URL=... \
SUPABASE_SECRET_KEY=... \
PORT=8080 \
node index.js
```

Na app Next.js, também precisas de `WORKER_API_SECRET=dev-secret` e
`WORKER_PUBLIC_URL=http://localhost:8080` no `.env` local para testar o
upload direto de ponta a ponta.
