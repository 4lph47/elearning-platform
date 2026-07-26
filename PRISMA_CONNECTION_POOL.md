# Fix: Prisma Connection Pool Timeout no Vercel

## Problema
```
Timed out fetching a new connection from the connection pool
(Current connection pool timeout: 10, connection limit: 5)
```

## Solução

### 1. Configurar Connection Pooling na Database

Se estiver usando **Supabase**:
- Vá para Settings > Database
- Use a **Connection Pooling URL** (porta 6543) em vez da Direct Connection
- Modo: **Transaction** (recomendado para serverless)

Exemplo:
```
DATABASE_URL="postgresql://user:password@host:6543/database?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/database"
```

### 2. Configurar no Vercel

No Vercel Dashboard > Settings > Environment Variables:

```env
DATABASE_URL=postgresql://user:password@host:6543/database?pgbouncer=true&connection_limit=5&pool_timeout=10
DIRECT_URL=postgresql://user:password@host:5432/database
```

### 3. Connection Limit

Para Vercel (Serverless):
- `connection_limit=5` (padrão, suficiente)
- `pool_timeout=10` (segundos)

Para reduzir timeouts:
- Use connection pooling da database (PgBouncer)
- Otimize queries (use `select` específico em vez de trazer tudo)
- Use `$transaction` para múltiplas queries relacionadas

### 4. Best Practices

```typescript
// ✅ BOM - específico
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true }
});

// ❌ EVITAR - traz tudo
const user = await prisma.user.findUnique({
  where: { id }
});

// ✅ BOM - usa transaction para múltiplas queries
const [courses, count] = await prisma.$transaction([
  prisma.course.findMany({ ... }),
  prisma.course.count({ ... })
]);

// ❌ EVITAR - múltiplas queries separadas
const courses = await prisma.course.findMany({ ... });
const count = await prisma.course.count({ ... });
```

### 5. Verificar Deploy

Após configurar, fazer redeploy no Vercel para aplicar as variáveis de ambiente.
