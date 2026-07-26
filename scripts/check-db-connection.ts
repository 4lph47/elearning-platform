/**
 * Script de diagnóstico de conexão do banco de dados
 * Uso: npx tsx scripts/check-db-connection.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
});

async function main() {
  console.log("🔍 Verificando conexão com o banco de dados...\n");

  // Informações da conexão
  console.log("📋 Configuração:");
  const dbUrl = process.env.DATABASE_URL || "não configurado";
  const directUrl = process.env.DIRECT_URL || "não configurado";
  
  // Mascarar password
  const maskUrl = (url: string) => {
    if (url === "não configurado") return url;
    return url.replace(/:[^:@]+@/, ":****@");
  };

  console.log(`  DATABASE_URL: ${maskUrl(dbUrl)}`);
  console.log(`  DIRECT_URL: ${maskUrl(directUrl)}\n`);

  // Verificar parâmetros de pooling
  if (dbUrl !== "não configurado") {
    const hasPgBouncer = dbUrl.includes("pgbouncer=true");
    const hasConnectionLimit = dbUrl.includes("connection_limit");
    const hasPoolTimeout = dbUrl.includes("pool_timeout");
    const port = dbUrl.match(/:(\d+)\//)?.[1];

    console.log("🔧 Parâmetros de Pooling:");
    console.log(`  Porta: ${port || "não detectada"}`);
    console.log(`  ${hasPgBouncer ? "✅" : "❌"} pgbouncer=true`);
    console.log(`  ${hasConnectionLimit ? "✅" : "❌"} connection_limit`);
    console.log(`  ${hasPoolTimeout ? "✅" : "❌"} pool_timeout\n`);

    if (!hasPgBouncer && process.env.NODE_ENV === "production") {
      console.log("⚠️  AVISO: pgbouncer=true não está configurado!");
      console.log("   Isso pode causar problemas em ambientes serverless.\n");
    }

    if (port !== "6543" && process.env.NODE_ENV === "production") {
      console.log("⚠️  AVISO: Porta não é 6543 (Transaction Pooler)!");
      console.log("   Recomendado usar o Transaction Pooler em produção.\n");
    }
  }

  // Testar conexão
  try {
    console.log("🔌 Testando conexão...");
    const startTime = Date.now();
    
    await prisma.$connect();
    const connectTime = Date.now() - startTime;
    
    console.log(`✅ Conectado com sucesso em ${connectTime}ms\n`);

    // Testar query simples
    console.log("📊 Testando query...");
    const queryStart = Date.now();
    
    const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "User"`;
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Query executada em ${queryTime}ms`);
    console.log(`   Resultado:`, result, "\n");

    // Informações da pool
    console.log("📈 Estatísticas:");
    const stats = await prisma.$metrics.json();
    console.log(JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error("❌ Erro ao conectar:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log("\n✅ Desconectado com sucesso");
  }
}

main()
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });
