"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { FadeLink } from "@/components/course/FadeLink";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Já tinha sessão (voltou atrás pro /login, ou entrou pelo link direto
  // com o browser a reaproveitar uma sessão antiga) — o formulário nunca
  // ia disparar de novo o router.push de handleSubmit, por isso ficava
  // preso aqui mesmo com a navbar já a mostrar o perfil.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, callbackUrl, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkMode, setMagicLinkMode] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email ou password inválidos");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("email", { email, callbackUrl, redirect: false });

    setLoading(false);

    if (result?.error) {
      setError("Não foi possível enviar o link. Tenta novamente.");
      return;
    }

    setMagicLinkSent(true);
  }

  if (status === "authenticated") return null;

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Entra na tua conta para continuar a aprender"
      footer={
        <>
          Ainda não tens conta?{" "}
          <FadeLink href="/register" className="font-medium text-blue-600 hover:text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
            Regista-te
          </FadeLink>
        </>
      }
    >
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-white/10 dark:bg-neutral-900 dark:shadow-black/40">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <GoogleIcon /> Continuar com Google
          </button>
        </div>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          <span className="text-xs text-slate-400 dark:text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>

        {magicLinkMode ? (
          magicLinkSent ? (
            <p className="text-center text-sm text-slate-600 dark:text-slate-300">
              Enviámos um link de acesso para <strong>{email}</strong>. Verifica a tua caixa de entrada.
            </p>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
              <div>
                <label htmlFor="magic-email" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="magic-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
              <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                {loading ? "A enviar..." : "Enviar link de acesso"}
              </Button>
              <button
                type="button"
                onClick={() => { setMagicLinkMode(false); setError(null); }}
                className="w-full text-center text-sm text-slate-500 hover:underline dark:text-slate-400"
              >
                Voltar ao login com password
              </button>
            </form>
          )
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-slate-500"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
              <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                {loading ? "A entrar..." : (
                  <>
                    Entrar <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => { setMagicLinkMode(true); setError(null); }}
              className="mt-3 w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Entrar sem password (link mágico)
            </button>
          </>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
        Demo: instrutor@example.com / aluno@example.com — password: password123
      </p>
    </AuthLayout>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.29v3.1C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 010-4.58v-3.1H1.29a12 12 0 000 10.78z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l4 3.1C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  );
}

