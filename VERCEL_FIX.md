# 🚨 FIX URGENTE: Connection Pool Timeout no Vercel

## O Problema
Suas funções serverless estão esgotando o pool de conexões do PostgreSQL/Supabase.

## Solução Imediata (5 minutos)

### Passo 1: Acessar o Painel da Vercel
1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto **elearning-platform**
3. Vá em **Settings** → **Environment Variables**

### Passo 2: Atualizar DATABASE_URL

#### Se você está usando Supabase:

1. **Obter a Connection String do Transaction Pooler:**
   - Acesse: https://app.supabase.com
   - Selecione seu projeto
   - Vá em **Settings** → **Database**
   - Role até **Connection pooling**
   - Copie a string do **Transaction mode** (porta 6543)
   - A URL deve ser algo como:
     ```
     postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
     ```

2. **Adicionar parâmetros de pooling:**
   - Adicione no final da URL:
     ```
     ?pgbouncer=true&connection_limit=1&pool_timeout=10
     ```
   
3. **URL final deve ficar assim:**
   ```
   postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=10
   ```

4. **No Vercel:**
   - Edite a variável `DATABASE_URL`
   - Cole a nova URL com os parâmetros
   - Marque: **Production**, **Preview**, **Development**
   - Clique em **Save**

### Passo 3: Configurar DIRECT_URL (para migrações)

1. **Obter a Direct Connection do Supabase:**
   - Ainda em **Settings** → **Database**
   - Role até **Connection string**
   - Copie a **URI** (porta 5432)

2. **No Vercel:**
   - Adicione nova variável: `DIRECT_URL`
   - Cole a URL direta (porta 5432, SEM pgbouncer)
   - Marque: **Production**, **Preview**, **Development**
   - Clique em **Save**

### Passo 4: Redeploy
1. Vá em **Deployments**
2. Clique nos **três pontinhos** do último deployment
3. Clique em **Redeploy**
4. ✅ Marque **Use existing Build Cache**
5. Clique em **Redeploy**

## Verificação

Após o redeploy (1-2 minutos):
1. Acesse sua aplicação
2. Navegue para uma aula
3. Verifique os logs em tempo real na Vercel
4. ✅ Os erros de timeout devem desaparecer

## Checklist Rápido

- [ ] Acessei o painel do Supabase
- [ ] Copiei a URL do Transaction Pooler (porta 6543)
- [ ] Adicionei `?pgbouncer=true&connection_limit=1&pool_timeout=10`
- [ ] Atualizei `DATABASE_URL` no Vercel
- [ ] Adicionei `DIRECT_URL` (porta 5432) no Vercel
- [ ] Fiz redeploy no Vercel
- [ ] Testei a aplicação

## Se ainda não resolver

Verifique os limites do seu plano:
- **Supabase Free**: Máximo de 60 conexões simultâneas
- **Vercel Hobby**: Até 100 funções serverless concorrentes
- Se estiver no limite, considere upgrade ou implementar rate limiting

## Exemplo Visual das URLs

```bash
# ❌ ERRADO (o que está causando o problema)
DATABASE_URL="postgresql://user:pass@host:5432/postgres"

# ✅ CORRETO (com pooling para serverless)
DATABASE_URL="postgresql://user:pass@host:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=10"
DIRECT_URL="postgresql://user:pass@host:5432/postgres"
```

## Suporte

Se precisar de ajuda:
1. Verifique os logs da Vercel em tempo real
2. Verifique o número de conexões ativas no Supabase Dashboard
3. Documente o erro específico que está vendo
