// Autenticação do worker de transcoding (fora do Next.js/Vercel — ver
// worker/README.md) — segredo partilhado por variável de ambiente, não
// sessão de utilizador (não há utilizador, é uma máquina).
export function isAuthorizedWorker(request: Request): boolean {
  const secret = process.env.WORKER_API_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
