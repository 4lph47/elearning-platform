# E-Learn — Plataforma de Cursos Online

Plataforma de e-learning estilo Udemy construída com Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma + PostgreSQL e NextAuth. Suporta duas áreas de utilizador — **instrutores** (criam cursos, módulos e aulas) e **alunos** (matriculam-se e consomem conteúdo). Toda aula tem **vídeo obrigatório**; documentos e imagens são anexos extra (materiais de apoio). Design minimalista, paleta monotone (escala de cinzentos) e ícones profissionais (lucide).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Prisma 6 + PostgreSQL
- NextAuth v4 (Credentials, sessão JWT)
- Zod (validação)
- Anthropic SDK (chatbot de apoio ao curso, modelo `claude-sonnet-5`)

## Funcionalidades

- Catálogo de cursos com busca, filtro por categoria, preço e avaliação (rating)
- Página de curso com módulos/aulas, currículo em accordion e preview grátis para não-matriculados
- Matrícula gratuita (MVP sem pagamentos reais — ver secção "Roadmap")
- Player de aula em vídeo (obrigatório, com retomar posição) + anexos extra por aula (PDF, imagem) nos "Recursos"
- Progresso por aula e por curso, visível na sidebar esquerda da aula e no dashboard do aluno
- Chatbot de apoio em cada aula (canto inferior direito, expansível) — responde a perguntas com o contexto completo do curso (currículo, descrição, aula atual)
- Área de instrutor: CRUD completo de cursos, módulos e aulas, upload de vídeo obrigatório, publicar/despublicar, definir preço
- Proteção de rotas por role (`STUDENT` / `INSTRUCTOR` / `ADMIN`) via middleware

## Correr localmente

### 1. Base de dados (Docker)

```bash
docker compose up -d
```

Isto arranca um Postgres 16 local (ver `docker-compose.yml`). Se preferires não usar Docker, aponta `DATABASE_URL` para qualquer Postgres acessível.

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Gera um `NEXTAUTH_SECRET` aleatório:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Adiciona a tua `ANTHROPIC_API_KEY` (necessária para o chatbot de apoio nas aulas — obtém em [console.anthropic.com](https://console.anthropic.com)). Sem esta chave, o resto da plataforma funciona normalmente; só o chatbot fica indisponível.

### 3. Instalar dependências, migrar e semear

```bash
npm install
npx prisma migrate dev
npm run db:seed
```

Utilizadores de demonstração criados pelo seed (password: `password123`):

- Instrutor: `instrutor@example.com`
- Aluno: `aluno@example.com`

### 4. Arrancar a app

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Storage de ficheiros (vídeo, PDF, imagens)

Cada aula suporta um dos quatro tipos de conteúdo principal — **vídeo, documento, imagem ou texto** — mais anexos extra opcionais (materiais de apoio de qualquer um destes tipos), à semelhança da Udemy.

O upload é feito em `app/api/upload/route.ts` e delegado numa abstração de storage em `lib/storage.ts` (interface `Storage` com `save()`/`delete()`). **Em desenvolvimento**, os ficheiros são gravados em disco local (`public/uploads/`).

**Isto é um bloqueador para deploy em produção (Vercel)**: o filesystem da Vercel é efémero e não persiste ficheiros entre deploys/instâncias. Antes de fazer deploy:

1. Escolher um storage cloud (ex: Cloudflare R2, AWS S3, Supabase Storage).
2. Implementar uma nova classe que satisfaça a interface `Storage` em `lib/storage.ts` (mesmo `save()`/`delete()`, mas gravando no bucket em vez de disco).
3. Trocar a instância exportada em `lib/storage.ts` para a nova implementação.

Nenhum outro ficheiro da aplicação precisa de mudar — toda a app usa apenas a interface `Storage`.

## Migração para Supabase (Postgres gerido)

O projeto usa Postgres "puro" via Prisma, pelo que migrar para o Postgres gerido da Supabase é apenas uma troca de connection string:

1. Criar um projeto em [supabase.com](https://supabase.com) e copiar a connection string (usar a versão com **connection pooler**, recomendada para ambientes serverless).
2. Atualizar `DATABASE_URL` no `.env` (ou nas env vars da Vercel):
   ```
   DATABASE_URL="postgresql://postgres.[ref]:[password]@[pooler-host]:6543/postgres?pgbouncer=true&connection_limit=1"
   ```
3. Aplicar as migrações à base de dados da Supabase:
   ```bash
   npx prisma migrate deploy
   ```
4. (Opcional) Popular com dados de demonstração: `npm run db:seed`.

Não é necessária nenhuma alteração ao `schema.prisma` nem ao código da aplicação — o Prisma fala com qualquer Postgres da mesma forma.

## Deploy na Vercel

1. **Storage**: garantir que `lib/storage.ts` já usa uma implementação cloud (ver secção acima) — obrigatório antes de qualquer deploy.
2. Importar o repositório na Vercel.
3. Configurar as env vars no projeto Vercel:
   - `DATABASE_URL` — connection string do Postgres em produção (ex: Supabase, ver acima)
   - `NEXTAUTH_SECRET` — gerar um valor novo e único para produção
   - `NEXTAUTH_URL` — URL pública do deploy (ex: `https://o-teu-dominio.vercel.app`)
   - Variáveis do storage cloud escolhido (ex: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, ou equivalentes)
4. Adicionar `prisma migrate deploy` como parte do build (ex: script `postinstall` ou `vercel-build` no `package.json`) para garantir que as migrações são aplicadas em cada deploy.
5. Fazer deploy. Confirmar depois do primeiro deploy:
   - Registo e login funcionam (aluno e instrutor)
   - Um instrutor consegue criar um curso, módulo e aula com upload real de ficheiro
   - Um aluno consegue matricular-se, ver o preview grátis e o conteúdo pago, e o progresso é gravado

## Roadmap (fora do MVP atual)

- **Pagamentos**: matrícula é gratuita/direta nesta versão. Para cursos pagos, adicionar Stripe Checkout, campo `price` em `Course`, e um modelo de `Order`/`Payment`, condicionando o acesso ao conteúdo à confirmação do pagamento.
- Avaliações/reviews de cursos, certificados de conclusão, notificações por email.

## Estrutura do projeto

```
/app             — rotas (App Router): landing, catálogo, curso, player, dashboard, instrutor, APIs
/components      — ui/, layout/, course/, player/, instructor/
/lib             — db.ts, auth.ts, storage.ts, validations.ts, instructor-guard.ts, slug.ts
/prisma          — schema.prisma, seed.ts, migrations/
docker-compose.yml — Postgres local
middleware.ts    — proteção de rotas por role
```
