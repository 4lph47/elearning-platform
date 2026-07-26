# Configuração de Connection Pooling para Ambientes Serverless

## Problema

Em ambientes serverless (Vercel, AWS Lambda, etc.), cada função cria sua própria instância do Prisma Client, o que pode rapidamente esgotar o pool de conexões do banco de dados, resultando em erros como:

```
FATAL: (ECHECKOUTTIMEOUT) unable to check out connection from the pool after 60000ms
```

## Solução: Usar Transaction Pooler (Supabase)

### 1. Configurar DATABASE_URL no Vercel

No painel da Vercel, configure a variável de ambiente `DATABASE_URL` para usar o **Transaction Pooler** (porta 6543):

```bash
DATABASE_URL="postgresql://postgres.[PROJECT-ID]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=10"
```

**Parâmetros importantes:**
- `pgbouncer=true` - Habilita o modo de pooling
- `connection_limit=1` - Limita cada função serverless a 1 conexão (recomendado)
- `pool_timeout=10` - Timeout de 10 segundos para obter uma conexão

### 2. Configurar DIRECT_URL no Vercel

Para migrações e operações que precisam de transações longas, use o **Direct Connection** ou **Session Pooler** (porta 5432):

```bash
DIRECT_URL="postgresql://postgres.[PROJECT-ID]:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres"
```

### 3. Encontrar suas Connection Strings no Supabase

1. Acesse o painel do Supabase: https://app.supabase.com
2. Selecione seu projeto
3. Vá em **Settings** → **Database**
4. Role até **Connection pooling**
5. Use:
   - **Transaction mode** (porta 6543) para `DATABASE_URL`
   - **Session mode** ou **Direct connection** (porta 5432) para `DIRECT_URL`

## Estrutura do Código

O arquivo `lib/db.ts` já está configurado para reutilizar a instância do Prisma Client:

```typescript
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// Reutiliza a mesma instância em todos os ambientes
globalForPrisma.prisma = prisma;
```

## Verificação

Após configurar:

1. Deploy no Vercel
2. Monitore os logs em tempo real
3. Verifique no Supabase Dashboard → **Reports** → **Database** se o número de conexões está estável

## Limites Recomendados

| Ambiente | connection_limit | Pool Size (Supabase) |
|----------|-----------------|----------------------|
| Vercel Free | 1 | 15-20 |
| Vercel Pro | 1-2 | 30-50 |
| Desenvolvimento | 5-10 | ilimitado (local) |

## Referências

- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Vercel Serverless Functions Limits](https://vercel.com/docs/functions/serverless-functions/runtimes#limits)
